"""
Append Medical Test Data from Second Dataset

Adds lab test data from the pinuto/laboratory-test-results-anonymized-dataset
to the existing medicaltest table, skipping duplicates.

Usage:
    cd backend
    .\venv\Scripts\Activate.ps1
    python -m scripts.append_medical_tests
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

KAGGLE_DATASET = "pinuto/laboratory-test-results-anonymized-dataset"
KAGGLE_FILE = "lab_test_results_public.csv"

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
    """
    if not name or not isinstance(name, str):
        return ""
    
    # Step 1: Lowercase
    normalized = name.lower()
    
    # Step 2: Remove text inside brackets
    normalized = re.sub(r'\([^)]*\)', '', normalized)
    normalized = re.sub(r'\[[^\]]*\]', '', normalized)
    normalized = re.sub(r'\{[^}]*\}', '', normalized)
    
    # Step 3: Remove special characters (keep alphanumeric and spaces)
    normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
    
    # Step 4: Normalize whitespace
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    return normalized


def load_kaggle_dataset() -> pd.DataFrame:
    """Load the lab test dataset from Kaggle."""
    print(f"Loading dataset from Kaggle: {KAGGLE_DATASET}")
    print(f"File: {KAGGLE_FILE}")
    
    df = kagglehub.load_dataset(
        KaggleDatasetAdapter.PANDAS,
        KAGGLE_DATASET,
        KAGGLE_FILE,
    )
    
    print(f"Loaded {len(df)} records from dataset")
    print(f"Columns: {list(df.columns)}")
    
    return df


def find_test_name_column(df: pd.DataFrame) -> str:
    """Find the column containing test names."""
    # Common column names for test names
    possible_names = [
        'test_name', 'test name', 'testname',
        'lab_test', 'lab test', 'labtest',
        'test', 'name', 'exam', 'examination',
        'analyte', 'parameter', 'test_type', 'test type'
    ]
    
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower in possible_names:
            return col
        # Check if column name contains 'test' and 'name'
        if 'test' in col_lower and 'name' in col_lower:
            return col
    
    # If not found by name, look for columns with string values that look like test names
    print("\nColumn samples to help identify test name column:")
    for col in df.columns:
        if df[col].dtype == 'object':
            sample = df[col].dropna().head(3).tolist()
            print(f"  {col}: {sample}")
    
    # Return first object column as fallback
    for col in df.columns:
        if df[col].dtype == 'object':
            return col
    
    raise ValueError("Could not find a suitable test name column")


def process_test_data(df: pd.DataFrame) -> List[Tuple[str, str]]:
    """Process the dataset to extract and normalize test names."""
    
    # Find the test name column
    test_column = find_test_name_column(df)
    print(f"\nUsing column: '{test_column}' for test names")
    
    # Extract unique test names
    test_names = df[test_column].dropna().unique()
    print(f"Found {len(test_names)} unique test names before normalization")
    
    # Process and deduplicate
    seen_normalized = {}
    result = []
    
    for name in test_names:
        name_str = str(name).strip()
        if not name_str or name_str.lower() in ['nan', 'none', '']:
            continue
            
        normalized = normalize_test_name(name_str)
        if not normalized or len(normalized) < 2:
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
    """Create a database connection."""
    print(f"\nConnecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def insert_tests(conn, tests: List[Tuple[str, str]]) -> int:
    """Insert test data, ignoring duplicates."""
    if not tests:
        print("No tests to insert")
        return 0
    
    # Use ON CONFLICT to ignore duplicates (normalized_name is unique)
    insert_sql = """
    INSERT INTO medicaltest (display_name, normalized_name)
    VALUES %s
    ON CONFLICT (normalized_name) DO NOTHING
    """
    
    with conn.cursor() as cur:
        # Get count before insert
        cur.execute("SELECT COUNT(*) FROM medicaltest")
        count_before = cur.fetchone()[0]
        
        # Batch insert
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
    skipped = len(tests) - inserted
    
    print(f"\nResults:")
    print(f"  - Tests in new dataset: {len(tests)}")
    print(f"  - New tests inserted: {inserted}")
    print(f"  - Duplicates skipped: {skipped}")
    print(f"  - Total tests in database: {count_after}")
    
    return inserted


def show_sample_new_tests(conn, limit: int = 10) -> None:
    """Show recently added tests."""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT id, display_name, normalized_name
            FROM medicaltest
            ORDER BY id DESC
            LIMIT {limit}
        """)
        rows = cur.fetchall()
    
    print(f"\nMost recently added tests:")
    print("-" * 80)
    for row in rows:
        id_, display, normalized = row
        print(f"  [{id_}] {display[:50]}")
    print("-" * 80)


# ============================================
# Main Execution
# ============================================

def main():
    """Main execution function."""
    print("=" * 60)
    print("Append Medical Test Data (Second Dataset)")
    print("=" * 60)
    
    try:
        # Step 1: Load dataset from Kaggle
        df = load_kaggle_dataset()
        
        # Step 2: Process and normalize data
        tests = process_test_data(df)
        
        if not tests:
            print("No valid test data found. Exiting.")
            sys.exit(1)
        
        # Step 3: Connect to database and insert
        conn = get_db_connection()
        
        try:
            inserted = insert_tests(conn, tests)
            show_sample_new_tests(conn)
            
            print("\n" + "=" * 60)
            print("APPEND COMPLETE")
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
