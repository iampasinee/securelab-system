from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class DTO(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='forbid', hide_input_in_errors=True)


class Versioned(DTO):
    expected_version: int = Field(ge=1)


T = TypeVar('T')


class Page(DTO, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
