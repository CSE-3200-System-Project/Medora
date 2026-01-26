"""
Medical Test Data Seeding Script

This script loads lab test data from the Kaggle dataset and seeds
the medicaltest table in the database.

Usage:
    pip install kagglehub[pandas-datasets]
    
    # From backend directory:
    python -m scripts.seed_medical_tests

Environment Variables (loaded from .env):
    SUPABASE_DATABASE_URL - PostgreSQL connection string (async format will be converted)
"""

import os
import re
import sys
from typing import List, Tuple
from pathlib import Path

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import kagglehub
from kagglehub import KaggleDatasetAdapter
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Load .env from backend directory
load_dotenv(backend_dir / ".env")


# ============================================
# Configuration
# ============================================

KAGGLE_DATASET = "asim2005/labs-test-data-extract-from-marham-pk"
KAGGLE_FILE = "labs_test_data.csv"
TEST_NAME_COLUMN = "Test Name"

# Get database URL from environment and convert async URL to sync
def get_sync_database_url() -> str:
    """Convert async database URL to sync format for psycopg2."""
    url = os.getenv("SUPABASE_DATABASE_URL", "")
    if not url:
        raise ValueError("SUPABASE_DATABASE_URL not set in environment")
    
    # Convert postgresql+asyncpg:// to postgresql://
    if "asyncpg" in url:
        url = url.replace("postgresql+asyncpg://", "postgresql://")
    
    return url


DATABASE_URL = get_sync_database_url()


# ============================================
# Data Processing Functions
# ============================================

def normalize_test_name(name: str) -> str:
    """
    Normalize a test name for deduplication and matching.
    
    Steps:
    1. Convert to lowercase
    2. Remove text inside brackets (parentheses, square, curly)
    3. Remove special characters (keep alphanumeric and spaces)
    4. Normalize whitespace (collapse multiple spaces, trim)
    
    Args:
        name: Original test name
        
    Returns:
        Normalized test name
    """
    if not name or not isinstance(name, str):
        return ""
    
    # Step 1: Lowercase
    normalized = name.lower()
    
    # Step 2: Remove text inside brackets
    # Remove content within parentheses: (...)
    normalized = re.sub(r'\([^)]*\)', '', normalized)
    # Remove content within square brackets: [...]
    normalized = re.sub(r'\[[^\]]*\]', '', normalized)
    # Remove content within curly braces: {...}
    normalized = re.sub(r'\{[^}]*\}', '', normalized)
    
    # Step 3: Remove special characters (keep alphanumeric and spaces)
    normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
    
    # Step 4: Normalize whitespace
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    return normalized


def load_kaggle_dataset() -> pd.DataFrame:
    """
    Load the lab test dataset from Kaggle.
    
    Returns:
        DataFrame with the dataset
    """
    print(f"Loading dataset from Kaggle: {KAGGLE_DATASET}")
    
    df = kagglehub.load_dataset(
        KaggleDatasetAdapter.PANDAS,
        KAGGLE_DATASET,
        KAGGLE_FILE,
    )
    
    print(f"Loaded {len(df)} records from dataset")
    print(f"Columns: {list(df.columns)}")
    
    return df


def process_test_data(df: pd.DataFrame) -> List[Tuple[str, str]]:
    """
    Process the dataset to extract and normalize test names.
    
    Args:
        df: Raw DataFrame from Kaggle
        
    Returns:
        List of tuples (display_name, normalized_name), deduplicated
    """
    # Check if the expected column exists
    if TEST_NAME_COLUMN not in df.columns:
        # Try to find a similar column
        possible_columns = [col for col in df.columns if 'test' in col.lower() or 'name' in col.lower()]
        if possible_columns:
            print(f"Column '{TEST_NAME_COLUMN}' not found. Available columns: {df.columns.tolist()}")
            print(f"Possible matches: {possible_columns}")
            # Use the first match
            test_column = possible_columns[0]
            print(f"Using column: {test_column}")
        else:
            raise ValueError(f"Column '{TEST_NAME_COLUMN}' not found in dataset. Available: {df.columns.tolist()}")
    else:
        test_column = TEST_NAME_COLUMN
    
    # Extract test names
    test_names = df[test_column].dropna().unique()
    print(f"Found {len(test_names)} unique test names before normalization")
    
    # Process and deduplicate
    seen_normalized = {}
    result = []
    
    for name in test_names:
        name_str = str(name).strip()
        if not name_str:
            continue
            
        normalized = normalize_test_name(name_str)
        if not normalized:
            continue
        
        # Keep the first display name for each normalized name
        if normalized not in seen_normalized:
            seen_normalized[normalized] = name_str
            result.append((name_str, normalized))
    
    print(f"After normalization and deduplication: {len(result)} unique tests")
    
    return result


# ============================================
# Database Functions
# ============================================

def get_db_connection():
    """
    Create a database connection.
    
    Returns:
        psycopg2 connection object
    """
    print(f"Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def create_table_if_not_exists(conn) -> None:
    """
    Create the medicaltest table if it doesn't exist.
    
    Args:
        conn: Database connection
    """
    create_sql = """
    CREATE TABLE IF NOT EXISTS medicaltest (
        id SERIAL PRIMARY KEY,
        display_name VARCHAR(500) NOT NULL,
        normalized_name VARCHAR(500) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_medicaltest_normalized_name 
    ON medicaltest(normalized_name);
    
    CREATE INDEX IF NOT EXISTS idx_medicaltest_is_active 
    ON medicaltest(is_active) WHERE is_active = TRUE;
    """
    
    with conn.cursor() as cur:
        cur.execute(create_sql)
    conn.commit()
    print("Table 'medicaltest' ensured to exist")


def insert_tests(conn, tests: List[Tuple[str, str]]) -> int:
    """
    Insert test data into the database, ignoring duplicates.
    
    Args:
        conn: Database connection
        tests: List of (display_name, normalized_name) tuples
        
    Returns:
        Number of rows inserted
    """
    if not tests:
        print("No tests to insert")
        return 0
    
    # Use ON CONFLICT to ignore duplicates
    insert_sql = """
    INSERT INTO medicaltest (display_name, normalized_name)
    VALUES %s
    ON CONFLICT (normalized_name) DO NOTHING
    """
    
    with conn.cursor() as cur:
        # Get count before insert
        cur.execute("SELECT COUNT(*) FROM medicaltest")
        count_before = cur.fetchone()[0]
        
        # Batch insert using execute_values for efficiency
        execute_values(
            cur,
            insert_sql,
            tests,
            template="(%s, %s)",
            page_size=1000
        )
        
        # Get count after insert
        cur.execute("SELECT COUNT(*) FROM medicaltest")
        count_after = cur.fetchone()[0]
    
    conn.commit()
    
    inserted = count_after - count_before
    print(f"Inserted {inserted} new tests (skipped {len(tests) - inserted} duplicates)")
    
    return inserted


def print_sample_data(conn, limit: int = 10) -> None:
    """
    Print sample data from the table for verification.
    
    Args:
        conn: Database connection
        limit: Number of rows to display
    """
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT id, display_name, normalized_name, is_active, created_at
            FROM medicaltest
            ORDER BY id
            LIMIT {limit}
        """)
        rows = cur.fetchall()
    
    print(f"\nSample data (first {limit} rows):")
    print("-" * 100)
    print(f"{'ID':<6} {'Display Name':<40} {'Normalized Name':<40} {'Active':<8}")
    print("-" * 100)
    
    for row in rows:
        id_, display, normalized, active, _ = row
        print(f"{id_:<6} {display[:38]:<40} {normalized[:38]:<40} {str(active):<8}")
    
    print("-" * 100)


# ============================================
# Main Execution
# ============================================

def main():
    """
    Main execution function.
    """
    print("=" * 60)
    print("Medical Test Data Seeding Script")
    print("=" * 60)
    
    try:
        # Step 1: Load dataset from Kaggle
        df = load_kaggle_dataset()
        
        # Step 2: Process and normalize data
        tests = process_test_data(df)
        
        if not tests:
            print("No valid test data found. Exiting.")
            sys.exit(1)
        
        # Step 3: Connect to database
        conn = get_db_connection()
        
        try:
            # Step 4: Create table if needed
            create_table_if_not_exists(conn)
            
            # Step 5: Insert data
            inserted = insert_tests(conn, tests)
            
            # Step 6: Show sample data
            print_sample_data(conn)
            
            # Summary
            print("\n" + "=" * 60)
            print("SEEDING COMPLETE")
            print(f"Total tests processed: {len(tests)}")
            print(f"New tests inserted: {inserted}")
            print("=" * 60)
            
        finally:
            conn.close()
            print("Database connection closed")
            
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
