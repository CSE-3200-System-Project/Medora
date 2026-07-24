from pydantic import BaseModel

class SpecialitySchema(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True

class SpecialityListResponse(BaseModel):
    specialities: list[SpecialitySchema]
    items: list[SpecialitySchema] = []
    total: int
    limit: int = 100
    offset: int = 0
    has_more: bool = False
    page: int = 1
    page_size: int = 100

    def model_post_init(self, __context) -> None:
        if not self.items and self.specialities:
            object.__setattr__(self, "items", self.specialities)
