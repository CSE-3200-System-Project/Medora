"""
Cleanup script to remove orphaned prescriptions.
Orphaned prescriptions are those that reference non-existent consultations.
"""
import asyncio
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import AsyncSessionLocal


async def cleanup_orphaned_prescriptions():
    """Find and delete prescriptions that reference non-existent consultations."""
    
    async with AsyncSessionLocal() as db:
        print("\n" + "="*60)
        print("ORPHANED PRESCRIPTIONS CLEANUP")
        print("="*60 + "\n")
        
        # Find orphaned prescriptions using raw SQL
        find_orphaned_sql = text("""
            SELECT 
                p.id,
                p.consultation_id,
                p.patient_id,
                p.doctor_id,
                p.type,
                p.status,
                p.created_at
            FROM prescriptions p
            LEFT JOIN consultations c ON p.consultation_id = c.id
            WHERE c.id IS NULL
        """)
        
        result = await db.execute(find_orphaned_sql)
        orphaned_prescriptions = result.fetchall()
        
        print(f"Total prescriptions checked")
        
        if not orphaned_prescriptions:
            print("\n✅ No orphaned prescriptions found!")
            print("="*60 + "\n")
            return
        
        print(f"\n❌ Found {len(orphaned_prescriptions)} orphaned prescription(s):\n")
        
        for prescription in orphaned_prescriptions:
            print(f"   - Prescription ID: {prescription[0]}")
            print(f"   - Missing Consultation ID: {prescription[1]}")
            print(f"   - Patient ID: {prescription[2]}")
            print(f"   - Doctor ID: {prescription[3]}")
            print(f"   - Type: {prescription[4]}")
            print(f"   - Status: {prescription[5]}")
            print(f"   - Created At: {prescription[6]}")
            print()
        
        print(f"📊 Summary: {len(orphaned_prescriptions)} orphaned prescription(s) found")
        print("="*60 + "\n")
        
        # Ask for confirmation
        response = input("Do you want to DELETE these orphaned prescriptions? (yes/no): ")
        
        if response.lower() != 'yes':
            print("\n❌ Cleanup cancelled. No prescriptions were deleted.")
            return
        
        # Delete orphaned prescriptions
        prescription_ids = [p[0] for p in orphaned_prescriptions]
        
        # First delete child records (medications, tests, surgeries)
        print("\n🗑️  Deleting child prescription items...")
        await db.execute(text("DELETE FROM medication_prescriptions WHERE prescription_id = ANY(:ids)"), 
                         {"ids": prescription_ids})
        await db.execute(text("DELETE FROM test_prescriptions WHERE prescription_id = ANY(:ids)"), 
                         {"ids": prescription_ids})
        await db.execute(text("DELETE FROM surgery_recommendations WHERE prescription_id = ANY(:ids)"), 
                         {"ids": prescription_ids})
        
        # Then delete the prescriptions
        print("🗑️  Deleting orphaned prescriptions...")
        delete_sql = text("DELETE FROM prescriptions WHERE id = ANY(:ids)")
        await db.execute(delete_sql, {"ids": prescription_ids})
        
        await db.commit()
        
        print(f"\n\n✅ Cleanup Complete!")
        print(f"   Deleted {len(prescription_ids)} orphaned prescription(s)")
        print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(cleanup_orphaned_prescriptions())
