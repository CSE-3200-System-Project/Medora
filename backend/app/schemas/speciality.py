from pydantic import BaseModel

class SpecialitySchema(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True

class SpecialityListResponse(BaseModel):
    specialities: list[SpecialitySchema]
    total: int
