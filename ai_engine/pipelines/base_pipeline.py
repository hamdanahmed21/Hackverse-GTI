"""
Base pipeline — all feature-specific pipelines inherit from this.
Each hackathon idea maps to one pipeline class.
"""
from abc import ABC, abstractmethod


class BasePipeline(ABC):
    def __init__(self, llm_service):
        self.llm = llm_service

    @abstractmethod
    async def run(self, input_data: dict) -> dict:
        """Execute the pipeline. Override in each feature pipeline."""
        pass

    def build_prompt(self, template: str, **kwargs) -> str:
        return template.format(**kwargs)
