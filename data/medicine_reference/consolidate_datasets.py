#!/usr/bin/env python3
"""
Medicine Dataset Consolidation Script
=====================================
This script consolidates multiple medicine datasets into a unified Final_Medicine_Dataset.csv
following a 4-layer canonical model:

Layer 1: Canonical Drug (generic-level, clinical-safe)
Layer 2: Brand Registry (Bangladesh-specific)
Layer 3: Pricing & Packaging
Layer 4: Disease Mapping (non-authoritative, for search only)

Primary source (backbone): Dataset 5 - Medicinal Products in Bangladesh
Pricing layer: Dataset 2 - All medicine and drug price data
Search intelligence: Dataset 3 - medicines.csv
Optional expansion: Dataset 4 - Drug Database (after cleanup)
"""

import pandas as pd
import re
from pathlib import Path

# Define base path
BASE_PATH = Path(__file__).parent

# Dataset paths
DATASET_5_PATH = BASE_PATH / "5_Medicinal_Products_in_Bangladesh" / "Medicinal Products in Bangladesh A Dataset of Generic and Brand Names, Dosages, and Manufacturers.csv"
DATASET_2_PATH = BASE_PATH / "2_All_medicine_data(20k)_Bangladesh" / "all_medicine_and_drug_price_data(20k)_Bangladesh.csv"
DATASET_3_PATH = BASE_PATH / "3_Medicines_Dataset" / "medicines.csv"
DATASET_4_PATH = BASE_PATH / "4_Drug_Pharma_New_Dataset" / "Drug_Database_5_Data Concatenation.csv"
DATASET_1_GENERIC_PATH = BASE_PATH / "1_Assorted_Medicine_Dataset_of_Bangladesh" / "generic.csv"

OUTPUT_PATH = BASE_PATH / "Final_Medicine_Dataset.csv"


def normalize_generic_name(name):
    """Normalize generic name for matching."""
    if pd.isna(name):
        return ""
    name = str(name).strip()
    # Remove "Generic Name" prefix (from Dataset 3)
    name = re.sub(r'^Generic Name\s+', '', name, flags=re.IGNORECASE)
    # Remove common prefixes/suffixes
    name = re.sub(r'\s*\[.*?\]\s*', '', name)  # Remove bracketed text like [Ascorbic acid]
    # Remove strength patterns at the end (e.g., "25 mg", "0.025 %")
    name = re.sub(r'\s+\d+[\d\.\s]*(?:mg|gm|ml|mcg|iu|%|units?)(?:\s*/\s*\d+[\d\.\s]*(?:mg|ml|gm))?$', '', name, flags=re.IGNORECASE)
    # Normalize to title case
    name = name.title()
    # Remove extra whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def normalize_generic_for_matching(name):
    """
    Aggressively normalize generic name for matching between datasets.
    Used specifically for matching Disease Mapping (Dataset 3) with Bangladesh data.
    """
    if pd.isna(name):
        return ""
    name = str(name).strip().lower()
    # Remove "Generic Name" prefix
    name = re.sub(r'^generic name\s+', '', name)
    # Remove bracketed text
    name = re.sub(r'\s*\[.*?\]\s*', '', name)
    # Remove strength patterns
    name = re.sub(r'\s+\d+[\d\.\s]*(?:mg|gm|ml|mcg|iu|%|units?)(?:\s*/\s*\d+[\d\.\s]*(?:mg|ml|gm))?$', '', name)
    # Remove special characters except + (for combinations)
    name = re.sub(r'[^\w\s\+]', '', name)
    # Remove extra whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def normalize_strength(strength):
    """Normalize strength field for consistent formatting."""
    if pd.isna(strength) or str(strength).strip() == "":
        return ""
    strength = str(strength).strip()
    # Normalize common patterns
    strength = re.sub(r'\s+', ' ', strength)
    return strength


def normalize_manufacturer(manufacturer):
    """Normalize manufacturer name."""
    if pd.isna(manufacturer):
        return ""
    manufacturer = str(manufacturer).strip()
    # Remove common suffixes for matching
    manufacturer = re.sub(r'\s*(Ltd\.|Ltd|Limited|Pvt\.?|Private)?\s*$', '', manufacturer, flags=re.IGNORECASE)
    manufacturer = manufacturer.strip()
    return manufacturer.title() if manufacturer else ""


def extract_generic_from_combined(combined_str):
    """Extract generic name from combined 'Generic Name and Strength' field."""
    if pd.isna(combined_str):
        return "", ""
    combined_str = str(combined_str).strip()
    # Try to split by common pharmaceutical strength patterns like "500 mg", "250 mg/5 ml", etc.
    match = re.match(r'^(.+?)\s+(\d+[\d\s\/\.\+\-]*(?:mg|gm|ml|mcg|iu|%|units?|IU)(?:\s*/\s*[\d\s]+(?:ml|gm))?)$', combined_str, re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return combined_str, ""


def load_dataset_5():
    """Load Dataset 5 - Primary brand-to-generic mapping (backbone)."""
    print("Loading Dataset 5 (Medicinal Products in Bangladesh)...")
    df = pd.read_csv(DATASET_5_PATH)
    df = df.rename(columns={
        'genericName': 'generic_name',
        'brandName': 'brand_name',
        'dosageType': 'dosage_form',
        'strength': 'strength',
        'manufacturer': 'manufacturer'
    })
    # Drop packageMark as it's not needed
    if 'packageMark' in df.columns:
        df = df.drop(columns=['packageMark'])
    
    df['generic_name'] = df['generic_name'].apply(normalize_generic_name)
    df['brand_name'] = df['brand_name'].str.strip()
    df['dosage_form'] = df['dosage_form'].str.strip() if 'dosage_form' in df.columns else ""
    df['strength'] = df['strength'].apply(normalize_strength)
    df['manufacturer'] = df['manufacturer'].str.strip()
    df['source'] = 'BD_Medicinal_Products'
    
    print(f"  Loaded {len(df)} records from Dataset 5")
    return df


def load_dataset_2():
    """Load Dataset 2 - Pricing layer."""
    print("Loading Dataset 2 (Pricing Data)...")
    df = pd.read_csv(DATASET_2_PATH)
    df = df.rename(columns={
        'medicine_name': 'brand_name',
        'category_name': 'dosage_form',
        'generic_name': 'generic_name',
        'strength': 'strength',
        'manufacturer_name': 'manufacturer',
        'unit': 'unit',
        'unit_size': 'unit_size',
        'price': 'price'
    })
    
    df['generic_name'] = df['generic_name'].apply(normalize_generic_name)
    df['brand_name'] = df['brand_name'].str.strip()
    df['strength'] = df['strength'].apply(normalize_strength)
    df['manufacturer'] = df['manufacturer'].str.strip()
    df['source'] = 'BD_Price_Data'
    
    # Drop slug column if present
    if 'slug' in df.columns:
        df = df.drop(columns=['slug'])
    
    print(f"  Loaded {len(df)} records from Dataset 2")
    return df


def load_dataset_3():
    """Load Dataset 3 - Disease mapping for search intelligence."""
    print("Loading Dataset 3 (Disease Mapping)...")
    df = pd.read_csv(DATASET_3_PATH, on_bad_lines='skip')
    
    # Extract relevant columns only
    relevant_cols = ['disease_name', 'med_name', 'generic_name']
    df = df[relevant_cols].copy()
    
    df = df.rename(columns={
        'med_name': 'brand_name',
        'disease_name': 'disease_indication'
    })
    
    # Clean disease name (remove count in parentheses)
    df['disease_indication'] = df['disease_indication'].apply(
        lambda x: re.sub(r'\s*\(\d+\)\s*$', '', str(x)) if pd.notna(x) else ""
    )
    
    # Extract generic name from complex format
    df['generic_name'] = df['generic_name'].apply(
        lambda x: re.sub(r'^Generic Name\s+', '', str(x)) if pd.notna(x) else ""
    )
    df['generic_name'] = df['generic_name'].apply(normalize_generic_name)
    df['brand_name'] = df['brand_name'].str.strip()
    
    # Remove duplicates
    df = df.drop_duplicates(subset=['brand_name', 'generic_name', 'disease_indication'])
    
    print(f"  Loaded {len(df)} records from Dataset 3")
    return df


def load_dataset_4():
    """Load Dataset 4 - Secondary brand expansion (after cleanup)."""
    print("Loading Dataset 4 (Drug Database Concatenation)...")
    df = pd.read_csv(DATASET_4_PATH)
    
    df = df.rename(columns={
        'Name of the Manufacturer': 'manufacturer',
        'Type': 'medicine_type',
        'Brand Name': 'brand_name',
        'Dosages Description': 'dosage_form',
        'Generic Name and Strength': 'generic_name_strength',
        'DAR': 'dar_code'
    })
    
    # Extract generic name and strength from combined field
    extracted = df['generic_name_strength'].apply(extract_generic_from_combined)
    df['generic_name'] = extracted.apply(lambda x: normalize_generic_name(x[0]))
    df['strength'] = extracted.apply(lambda x: normalize_strength(x[1]))
    
    df['brand_name'] = df['brand_name'].str.strip()
    df['manufacturer'] = df['manufacturer'].str.strip()
    df['dosage_form'] = df['dosage_form'].str.strip()
    df['source'] = 'Drug_Database_Concat'
    
    # Filter to Allopathic only (most relevant for general medicine)
    # Handle NaN values in medicine_type
    df = df[df['medicine_type'].fillna('').str.lower() == 'allopathic'].copy()
    
    # Drop intermediate columns
    df = df.drop(columns=['generic_name_strength', 'medicine_type', 'dar_code'], errors='ignore')
    
    print(f"  Loaded {len(df)} records from Dataset 4 (Allopathic only)")
    return df


def load_generic_indications():
    """Load generic name to indication mapping from Dataset 1's generic.csv."""
    print("Loading Generic-to-Indication mappings from Dataset 1...")
    try:
        df = pd.read_csv(DATASET_1_GENERIC_PATH)
        # Keep only relevant columns
        df = df[['generic name', 'indication']].copy()
        df = df.rename(columns={
            'generic name': 'generic_name',
            'indication': 'indication_name'
        })
        # Normalize generic name for matching
        df['generic_name_normalized'] = df['generic_name'].apply(normalize_generic_for_matching)
        # Filter out empty indications
        df = df[df['indication_name'].notna() & (df['indication_name'] != '')]
        # Group by generic name
        indication_map = df.groupby('generic_name_normalized')['indication_name'].apply(
            lambda x: '; '.join(sorted(set(x)))
        ).reset_index()
        indication_map = indication_map.rename(columns={'indication_name': 'bd_indication'})
        print(f"  Loaded {len(indication_map)} generic-to-indication mappings from Dataset 1")
        return indication_map
    except Exception as e:
        print(f"  Warning: Could not load generic indications: {e}")
        return pd.DataFrame()


def create_canonical_drugs(df_backbone, df_pricing):
    """
    Layer 1: Create Canonical Drug table (generic-level, clinical-safe).
    Source: Minimal generic normalization from datasets 2 and 5.
    """
    print("\n=== Creating Layer 1: Canonical Drug Table ===")
    
    # Combine unique generics from backbone and pricing
    generics_5 = df_backbone[['generic_name', 'strength', 'dosage_form']].copy()
    generics_2 = df_pricing[['generic_name', 'strength', 'dosage_form']].copy()
    
    all_generics = pd.concat([generics_5, generics_2], ignore_index=True)
    
    # Deduplicate
    all_generics = all_generics.drop_duplicates(subset=['generic_name', 'strength', 'dosage_form'])
    
    # Filter out empty generic names
    all_generics = all_generics[all_generics['generic_name'].str.len() > 0]
    
    # Assign drug IDs
    all_generics = all_generics.reset_index(drop=True)
    all_generics['drug_id'] = range(1, len(all_generics) + 1)
    
    # Reorder columns
    canonical_drugs = all_generics[['drug_id', 'generic_name', 'strength', 'dosage_form']].copy()
    
    print(f"  Created {len(canonical_drugs)} canonical drug entries")
    return canonical_drugs


def create_brand_registry(df_backbone, df_expansion, canonical_drugs):
    """
    Layer 2: Create Brand Registry (Bangladesh-specific).
    Primary source: Dataset 5 (Medicinal Products in Bangladesh)
    Secondary enrichment: Dataset 4 (after cleanup)
    """
    print("\n=== Creating Layer 2: Brand Registry ===")
    
    # Process backbone brands
    brands_5 = df_backbone[['brand_name', 'generic_name', 'strength', 'dosage_form', 'manufacturer', 'source']].copy()
    
    # Process expansion brands (Dataset 4)
    brands_4 = df_expansion[['brand_name', 'generic_name', 'strength', 'dosage_form', 'manufacturer', 'source']].copy()
    
    # Combine
    all_brands = pd.concat([brands_5, brands_4], ignore_index=True)
    
    # Remove duplicates (prefer backbone source)
    all_brands = all_brands.drop_duplicates(subset=['brand_name', 'generic_name', 'strength', 'dosage_form'], keep='first')
    
    # Filter out empty brand names
    all_brands = all_brands[all_brands['brand_name'].str.len() > 0]
    
    # Create brand-to-drug mapping
    # Merge with canonical drugs to get drug_id
    brand_registry = all_brands.merge(
        canonical_drugs[['drug_id', 'generic_name', 'strength', 'dosage_form']],
        on=['generic_name', 'strength', 'dosage_form'],
        how='left'
    )
    
    # Assign brand IDs
    brand_registry = brand_registry.reset_index(drop=True)
    brand_registry['brand_id'] = range(1, len(brand_registry) + 1)
    
    # Add country
    brand_registry['country'] = 'BD'
    
    # Reorder columns
    brand_registry = brand_registry[['brand_id', 'brand_name', 'generic_name', 'strength', 
                                      'dosage_form', 'manufacturer', 'drug_id', 'country', 'source']]
    
    print(f"  Created {len(brand_registry)} brand registry entries")
    print(f"    - From backbone (Dataset 5): {len(brands_5)}")
    print(f"    - From expansion (Dataset 4): {len(brands_4)}")
    
    return brand_registry


def create_pricing_layer(df_pricing, brand_registry):
    """
    Layer 3: Create Pricing & Packaging layer.
    Source: Dataset 2 (all_medicine_and_drug_price_data)
    Prices are linked to brands where possible.
    """
    print("\n=== Creating Layer 3: Pricing & Packaging ===")
    
    pricing = df_pricing[['brand_name', 'generic_name', 'strength', 'dosage_form', 
                          'manufacturer', 'unit', 'unit_size', 'price']].copy()
    
    # Filter out invalid prices
    pricing = pricing[pricing['price'].notna()]
    pricing = pricing[pricing['price'] > 0]
    
    # Attempt to link to brand_id
    pricing = pricing.merge(
        brand_registry[['brand_id', 'brand_name', 'generic_name', 'strength', 'dosage_form']],
        on=['brand_name', 'generic_name', 'strength', 'dosage_form'],
        how='left'
    )
    
    # Remove duplicates
    pricing = pricing.drop_duplicates(subset=['brand_name', 'generic_name', 'strength', 'dosage_form', 'price'])
    
    # Assign pricing IDs
    pricing = pricing.reset_index(drop=True)
    pricing['price_id'] = range(1, len(pricing) + 1)
    
    # Reorder columns
    pricing = pricing[['price_id', 'brand_id', 'brand_name', 'generic_name', 'strength', 
                       'dosage_form', 'manufacturer', 'unit', 'unit_size', 'price']]
    
    print(f"  Created {len(pricing)} pricing entries")
    return pricing


def create_disease_mapping(df_disease, brand_registry):
    """
    Layer 4: Create Disease Mapping (non-authoritative, search only).
    Source: Dataset 3 (medicines.csv)
    Used only for search suggestions with disclaimers.
    
    Note: Since Dataset 3 is from India (netmeds.com), we map by generic name
    rather than brand name to provide useful disease indication data.
    Uses aggressive normalization for better matching.
    """
    print("\n=== Creating Layer 4: Disease Mapping (Search Intelligence) ===")
    
    disease_map = df_disease[['brand_name', 'generic_name', 'disease_indication']].copy()
    
    # Filter out empty values
    disease_map = disease_map[disease_map['disease_indication'].str.len() > 0]
    disease_map = disease_map[disease_map['generic_name'].str.len() > 0]
    
    # Create normalized generic name for matching
    disease_map['generic_name_normalized'] = disease_map['generic_name'].apply(normalize_generic_for_matching)
    
    # Create generic-to-disease mapping (aggregate by normalized generic name)
    generic_disease_map = disease_map.groupby('generic_name_normalized')['disease_indication'].apply(
        lambda x: '; '.join(sorted(set(x)))
    ).reset_index()
    
    print(f"  Created {len(generic_disease_map)} generic-to-disease mappings")
    return generic_disease_map


def create_final_dataset(canonical_drugs, brand_registry, pricing, disease_map, bd_indication_map=None):
    """
    Merge all layers into the final consolidated dataset.
    This creates a unified view that respects layer boundaries.
    """
    print("\n=== Creating Final Consolidated Dataset ===")
    
    # Start with brand registry as base (most comprehensive)
    final_df = brand_registry.copy()
    
    # Create normalized generic name for matching with disease data
    final_df['generic_name_normalized'] = final_df['generic_name'].apply(normalize_generic_for_matching)
    
    # Merge pricing information (left join to keep all brands)
    pricing_subset = pricing[['brand_name', 'generic_name', 'strength', 'dosage_form', 
                               'unit', 'unit_size', 'price']].drop_duplicates(
        subset=['brand_name', 'generic_name', 'strength', 'dosage_form'], keep='first'
    )
    
    final_df = final_df.merge(
        pricing_subset,
        on=['brand_name', 'generic_name', 'strength', 'dosage_form'],
        how='left'
    )
    
    # Merge disease mapping by normalized generic name (since Dataset 3 has different brand names)
    final_df = final_df.merge(
        disease_map.rename(columns={'disease_indication': 'common_uses_india'}),
        on='generic_name_normalized',
        how='left'
    )
    
    # Merge Bangladesh-specific indication data if available
    if bd_indication_map is not None and len(bd_indication_map) > 0:
        final_df = final_df.merge(
            bd_indication_map,
            on='generic_name_normalized',
            how='left'
        )
        # Combine indications: prefer BD data, fall back to India data
        final_df['common_uses'] = final_df.apply(
            lambda row: row['bd_indication'] if pd.notna(row.get('bd_indication')) and row.get('bd_indication') != '' 
            else (row['common_uses_india'] if pd.notna(row.get('common_uses_india')) else ''),
            axis=1
        )
        final_df = final_df.drop(columns=['common_uses_india', 'bd_indication'], errors='ignore')
    else:
        final_df = final_df.rename(columns={'common_uses_india': 'common_uses'})
    
    # Clean up and finalize
    final_df = final_df.fillna({
        'unit': '',
        'unit_size': '',
        'price': '',
        'common_uses': ''
    })
    
    # Add metadata columns
    final_df['data_source'] = final_df['source']
    final_df['common_uses_disclaimer'] = final_df['common_uses'].apply(
        lambda x: 'Non-authoritative - for search only' if x else ''
    )
    
    # Remove source and temporary columns (replaced by data_source)
    final_df = final_df.drop(columns=['source', 'generic_name_normalized'], errors='ignore')
    
    # Final column ordering
    final_columns = [
        'brand_id', 'brand_name', 'generic_name', 'strength', 'dosage_form',
        'manufacturer', 'drug_id', 'country',
        'unit', 'unit_size', 'price',
        'common_uses', 'common_uses_disclaimer',
        'data_source'
    ]
    
    final_df = final_df[final_columns]
    
    # Sort by brand name
    final_df = final_df.sort_values(['brand_name', 'generic_name', 'strength']).reset_index(drop=True)
    
    # Reassign brand_ids after sorting
    final_df['brand_id'] = range(1, len(final_df) + 1)
    
    print(f"  Final dataset contains {len(final_df)} entries")
    return final_df


def validate_dataset(df):
    """Validate the final dataset for quality and integrity."""
    print("\n=== Dataset Validation ===")
    
    issues = []
    
    # Check for empty brand names
    empty_brands = df['brand_name'].isna().sum() + (df['brand_name'] == '').sum()
    if empty_brands > 0:
        issues.append(f"Found {empty_brands} entries with empty brand names")
    
    # Check for empty generic names
    empty_generics = df['generic_name'].isna().sum() + (df['generic_name'] == '').sum()
    if empty_generics > 0:
        issues.append(f"Found {empty_generics} entries with empty generic names")
    
    # Check for duplicate entries
    duplicates = df.duplicated(subset=['brand_name', 'generic_name', 'strength', 'dosage_form']).sum()
    if duplicates > 0:
        issues.append(f"Found {duplicates} duplicate entries")
    
    # Check pricing validity
    price_col = df['price'].replace('', pd.NA)
    valid_prices = price_col.notna().sum()
    print(f"  Entries with pricing: {valid_prices} ({valid_prices/len(df)*100:.1f}%)")
    
    # Check common uses coverage
    has_uses = (df['common_uses'] != '').sum()
    print(f"  Entries with common uses: {has_uses} ({has_uses/len(df)*100:.1f}%)")
    
    # Check manufacturer coverage
    has_manufacturer = (df['manufacturer'].notna() & (df['manufacturer'] != '')).sum()
    print(f"  Entries with manufacturer: {has_manufacturer} ({has_manufacturer/len(df)*100:.1f}%)")
    
    if issues:
        print("\n  Issues found:")
        for issue in issues:
            print(f"    - {issue}")
    else:
        print("\n  No critical issues found!")
    
    return len(issues) == 0


def main():
    """Main execution function."""
    print("=" * 60)
    print("Medicine Dataset Consolidation")
    print("=" * 60)
    
    # Load all datasets
    df_backbone = load_dataset_5()
    df_pricing = load_dataset_2()
    df_disease = load_dataset_3()
    df_expansion = load_dataset_4()
    
    # Create Layer 1: Canonical Drugs
    canonical_drugs = create_canonical_drugs(df_backbone, df_pricing)
    
    # Create Layer 2: Brand Registry
    brand_registry = create_brand_registry(df_backbone, df_expansion, canonical_drugs)
    
    # Create Layer 3: Pricing
    pricing = create_pricing_layer(df_pricing, brand_registry)
    
    # Create Layer 4: Disease Mapping
    disease_map = create_disease_mapping(df_disease, brand_registry)
    
    # Load additional indication data from Dataset 1 (Bangladesh-specific)
    bd_indication_map = load_generic_indications()
    
    # Create Final Consolidated Dataset
    final_df = create_final_dataset(canonical_drugs, brand_registry, pricing, disease_map, bd_indication_map)
    
    # Validate
    validate_dataset(final_df)
    
    # Save final dataset
    print(f"\n=== Saving Final Dataset ===")
    final_df.to_csv(OUTPUT_PATH, index=False)
    print(f"  Saved to: {OUTPUT_PATH}")
    print(f"  Total entries: {len(final_df)}")
    
    # Print summary statistics
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total medicines in final dataset: {len(final_df)}")
    print(f"Unique brands: {final_df['brand_name'].nunique()}")
    print(f"Unique generics: {final_df['generic_name'].nunique()}")
    print(f"Unique manufacturers: {final_df['manufacturer'].nunique()}")
    print(f"Entries with pricing: {(final_df['price'] != '').sum()}")
    print(f"Entries with common uses: {(final_df['common_uses'] != '').sum()}")
    print("=" * 60)
    
    return final_df


if __name__ == "__main__":
    main()
