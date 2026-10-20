"""
app.py — the image processing example as a Simple Steps application.

    simple-steps run examples/image_processing/app.py
    python examples/image_processing/app.py

Its workflow, ``workspace/projects/image_processing/images.simple-steps-workflow``,
declares the folder of images as the resource ``image_directory``.
``runme.py`` runs it headlessly and checks it.
"""

from pathlib import Path

from SIMPLE_STEPS import App

import image_tools

app = App(
    tools=[image_tools],
    resources=[image_tools.ImageDirectory],
    workspace=str(Path(__file__).resolve().parent / "workspace"),
    title="Image processing: a folder of images as a resource",
)

if __name__ == "__main__":
    app.serve()
