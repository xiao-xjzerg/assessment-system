"""通用响应格式"""
from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class ResponseModel(BaseModel):
    """统一响应格式"""
    code: int = 200
    message: str = "success"
    data: Any = None


class PaginatedData(BaseModel, Generic[T]):
    """分页数据"""
    items: List[T] = []
    total: int = 0
    page: int = 1
    page_size: int = 20


class PaginatedResponse(BaseModel):
    """分页响应"""
    code: int = 200
    message: str = "success"
    data: Optional[PaginatedData] = None
