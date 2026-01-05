"""
Seed script to populate specialities table with initial data.
Run this once after creating the specialities table.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.db.models.speciality import Speciality

SPECIALITIES = [
    (4, "Aesthetic Dermatologist"),
    (5, "Anesthesiologist"),
    (6, "Cardiac Surgeon"),
    (7, "Cardiologist"),
    (8, "Cardiothoracic and Vascular Surgeon"),
    (9, "Cardiothoracic Surgeon"),
    (10, "Chest Specialist"),
    (11, "Colorectal Surgeon"),
    (12, "Cosmetologist"),
    (13, "Dentist"),
    (14, "Dermatologist"),
    (15, "Dermatosurgeon"),
    (16, "Endocrinologist"),
    (17, "Family Medicine Specialist"),
    (18, "Gastroenterologist"),
    (19, "Gynecologists"),
    (20, "Hair Transplant Surgeon"),
    (21, "Hematologist"),
    (22, "Hepatologist"),
    (23, "Immunologist"),
    (24, "Infertility Specialist"),
    (25, "Internal Medicine"),
    (26, "Internal Medicine Specialist"),
    (27, "Interventional Cardiologist"),
    (28, "Laparoscopist"),
    (29, "Maxillofacial Surgeon"),
    (30, "Medicine Specialist"),
    (31, "Microbiologist"),
    (32, "Neonatologist"),
    (34, "Nephrologist"),
    (35, "Neurologist"),
    (36, "Neurosurgeon"),
    (37, "Nutritionist"),
    (38, "Oncologist"),
    (39, "Ophthalmologist"),
    (40, "Orthopedist"),
    (41, "Otolaryngologists (ENT)"),
    (42, "Pathologist"),
    (43, "Pediatric Cardiologist"),
    (44, "Pediatric Dermatologist"),
    (45, "Pediatric Surgeon"),
    (46, "Pediatrician"),
    (47, "Pediatrician & Neonatologist"),
    (48, "Physiotherapist"),
    (49, "Plastic Surgeon"),
    (50, "Psychiatrist"),
    (51, "Pulmonologist"),
    (52, "Radiologist"),
    (53, "Renal Specialist"),
    (54, "Respiratory Specialist"),
    (55, "Rheumatologist"),
    (56, "Sonologist"),
    (57, "Surgeon"),
    (58, "Trauma Surgeon"),
    (59, "Trichologist"),
    (60, "Urologist"),
    (61, "Vascular Surgeon"),
    (62, "Venereologist"),
    (63, "Obstetrician"),
    (64, "Andrology & Transplant Surgeon"),
    (65, "Pediatric Endocrinologist"),
    (66, "Laparoscopic Surgeon"),
    (67, "Orthopedic Surgeon"),
    (68, "Pediatric Nephrologist"),
    (69, "General Physician"),
    (70, "Diabetologist"),
    (71, "Diabetes Specialist"),
    (72, "Neuromedicine Specialist"),
    (73, "Gynecologist & Obstetrician"),
    (74, "Allergy Skin-VD"),
    (75, "Sexual Medicine Specialist"),
    (76, "Laser Dermatosurgeon"),
    (77, "Clinical Nutritionist"),
    (78, "Nucleologists"),
    (79, "Pediatric Pulmonologist"),
    (80, "Pediatric Neurologist"),
    (81, "Thoracic Surgeon"),
    (82, "Epidemiologist"),
    (83, "Andrologist"),
    (84, "General Surgeon"),
    (85, "Cosmetic Dentist"),
    (86, "Neuropsychologist"),
    (87, "Geriatrician"),
    (88, "Prosthodontist"),
    (89, "Spine Surgeon"),
    (90, "Pediatric Hematologist"),
    (91, "Pediatric Gastroenterologist"),
    (92, "Physical Medicine"),
    (93, "Rehabilitation Specialist"),
    (94, "Gynecologic Oncologist"),
    (95, "Biochemist"),
    (96, "Pediatric Neurosurgeon"),
    (97, "Dietician"),
    (98, "Sports Physician"),
    (99, "Neuro Physician"),
    (100, "Pulmonary Medicine Specialist"),
    (101, "Critical Care Medicine Specialist"),
    (102, "Pain Management Specialist"),
    (103, "Critical Care Specialist"),
    (104, "Colorectal & Laparoscopic Surgery"),
    (105, "Colorectal & Laparoscopic Surgeon"),
    (106, "Maxillofacial and Dental Surgeon"),
    (107, "Transfusion Medicine Specialist"),
    (108, "Pediatric Hematologist & Oncologist"),
    (109, "Hepatobiliary Surgeon"),
    (110, "Psychologist"),
    (111, "Medicine and Kidny"),
]

async def seed_specialities():
    """Insert all specialities into the database."""
    engine = create_async_engine(settings.SUPABASE_DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            for spec_id, spec_name in SPECIALITIES:
                speciality = Speciality(id=spec_id, name=spec_name)
                session.add(speciality)
            
            await session.commit()
            print(f"✅ Successfully seeded {len(SPECIALITIES)} specialities!")
        except Exception as e:
            await session.rollback()
            print(f"❌ Error seeding specialities: {e}")
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_specialities())
