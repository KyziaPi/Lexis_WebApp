import re
from enum import Enum
from dataclasses import dataclass

class TokenType(Enum):
    IDENT = "IDENT"    # command words
    INT = "INT"        # numbers
    PIPE = "PIPE"      # '|'
    STRING = "STRING"  # quoted text
    EOF = "EOF"        # end of input

@dataclass
class Token:
    type: TokenType
    text: str

    def __repr__(self):
        return f"Token({self.type}, '{self.text}')"

class LexerError(Exception): 
    pass

class Lexer:
    def __init__(self, src: str):
        self.src = src
        self.pos = 0

        self.regex_patterns = [
            (r'\s+', None),                
            (r'\|', TokenType.PIPE),       
            (r'\d+', TokenType.INT),      
            (r'"([^"\\]|\\.)*"', TokenType.STRING),  
            (r'[A-Za-z_][A-Za-z0-9_./\\-]*', TokenType.IDENT), 
        ]

    def next_token(self):
        if self.pos >= len(self.src):
            return Token(TokenType.EOF, "")

        for pattern, ttype in self.regex_patterns:
            regex = re.compile(pattern)
            m = regex.match(self.src, self.pos)
            if m:
                text = m.group(0)
                self.pos = m.end()

                if not ttype:  # skips whitespace
                    return self.next_token()

                if ttype == TokenType.STRING:
                    text = text[1:-1]  
                    text = text.replace('\\"', '"').replace('\\\\', '\\')

                return Token(ttype, text)

        raise LexerError(f"Unexpected character at: {self.src[self.pos:]}")

    def tokens(self):
        toks = []
        while True:
            tok = self.next_token()
            toks.append(tok)
            if tok.type == TokenType.EOF:
                break
        return toks