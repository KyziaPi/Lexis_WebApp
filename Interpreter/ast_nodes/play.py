from dataclasses import dataclass
from typing import Optional
from .base import Node

@dataclass
class File(Node):
    filename: Optional[str] = None

@dataclass
class Start(Node):
    pass

@dataclass
class Word(Node):
    word: Optional[str] = None

class Words(Node):
    pass

@dataclass
class MaxGuesses(Node):
    n: int

@dataclass
class Guess(Node):
    word: str

class Show(Node):
    pass

class Edit(Node):
    pass

class Help(Node):
    pass

class Quit(Node):
    pass