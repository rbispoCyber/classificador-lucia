import sys
import os

# Adiciona o diretório 'backend' ao path para que o módulo 'app' seja encontrado
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app
