"""
Example pipeline — rename/replace with your actual feature.
e.g. AccessibilityPipeline, StudyCoachPipeline, JobPrepPipeline
"""
from ai_engine.pipelines.base_pipeline import BasePipeline


class ExamplePipeline(BasePipeline):
    async def run(self, input_data: dict) -> dict:
        prompt = self.build_prompt(
            "Analyse the following input and return structured results:\n\n{content}",
            content=input_data.get("content", ""),
        )
        result = await self.llm.run(prompt)
        return {"output": result, "pipeline": "example"}
