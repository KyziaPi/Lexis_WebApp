from dataclasses import dataclass
from typing import List
from .base import Node

@dataclass
class Create(Node):
    filename: str

@dataclass
class File(Node):
    filename: str

@dataclass
class Categories(Node): 
    headers: List[str]

@dataclass
class Add(Node):
    word: str
    values: List[str]

class ListWords(Node):
    pass

@dataclass
class Edit(Node):
    index: int
    values: List[str]

@dataclass
class Delete(Node):
    index: int

@dataclass
class DeleteFile(Node):
    filename: str

class Done(Node):
    pass

class Help(Node):
    pass