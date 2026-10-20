"""
image_tools.py — the image processing example's resource and tools.

A folder of images is a *resource*: something tools use that isn't data. The
workflow declares one, named ``image_directory``, and reads it through its
two bound tools:

- ``res["image_directory"].files`` — a source: one row per image file;
- ``res["image_directory"].load`` — per row: the image, as a numpy array.

Every other tool takes an image (a ``uint8`` array, height × width × 3) and
returns a number, a colour, a yes/no, or another image. The grid shows an
array like this as a picture, so each step's images can be seen in the UI.

Only reading the files needs Pillow (``pip install "simple-steps[media]"``);
the processing is plain numpy. The file imports nothing from its folder, so
the main example can import it as ``image_processing.image_tools``.

    simple-steps run examples/image_processing/app.py
    python examples/image_processing/runme.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from SIMPLE_STEPS import simple_step_resource, simple_step_tool

#: The sample images that ship with this example.
SAMPLES = Path(__file__).resolve().parent / "sample_images"

IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".bmp", ".gif")


def pillow_missing() -> str | None:
    """Why the images can't be read, or None when they can."""
    try:
        import PIL  # noqa: F401
    except ImportError:
        return 'reading image files needs Pillow: pip install "simple-steps[media]"'
    return None


# ─────────────────────────────────────────────────────────────────────────
# The resource — a folder of images
# ─────────────────────────────────────────────────────────────────────────

@simple_step_resource
class ImageDirectory:
    """A folder of image files.

    ``path`` is the folder; a relative path is read from this example's
    folder, so the default, ``sample_images``, is the images shipped here.
    """

    def __init__(self, path: str = "sample_images"):
        folder = Path(path).expanduser()
        self.folder = folder if folder.is_absolute() else Path(__file__).resolve().parent / folder
        if not self.folder.is_dir():
            raise ValueError(f"no folder at {self.folder}")

    @simple_step_tool
    def files(self) -> pd.DataFrame:
        """One row per image in the folder, sorted by name: its file name.

        A source — it reads no step: ``res["image_directory"].files[mod.source()]()``.
        """
        names = sorted(p.name for p in self.folder.iterdir()
                       if p.suffix.lower() in IMAGE_SUFFIXES)
        return pd.DataFrame({"file": names})

    @simple_step_tool
    def load(self, file: str) -> np.ndarray:
        """The image in one file, as an RGB array.

        Args:
            file: the image's file name, in this folder.
        """
        missing = pillow_missing()
        if missing:
            raise RuntimeError(missing)
        from PIL import Image

        with Image.open(self.folder / file) as image:
            return np.asarray(image.convert("RGB"))


# ─────────────────────────────────────────────────────────────────────────
# Measuring an image — one number, colour or yes/no per image
# ─────────────────────────────────────────────────────────────────────────

@simple_step_tool(category="Images")
def image_width(image: np.ndarray) -> int:
    """The image's width, in pixels.

    Args:
        image: an image from an earlier step.
    """
    return int(image.shape[1])


@simple_step_tool(category="Images")
def mean_brightness(image: np.ndarray) -> float:
    """How bright the image is: the mean pixel value, 0 (black) to 255 (white).

    Args:
        image: an image from an earlier step.
    """
    return round(float(image.mean()), 1)


@simple_step_tool(category="Images")
def average_color(image: np.ndarray) -> str:
    """The image's average colour, as a hex code such as ``#d2734a``.

    Args:
        image: an image from an earlier step.
    """
    r, g, b = (int(round(c)) for c in image.reshape(-1, 3).mean(axis=0))
    return f"#{r:02x}{g:02x}{b:02x}"


@simple_step_tool(category="Images")
def is_dark(image: np.ndarray, threshold: float = 80) -> bool:
    """Whether the image is dark: its mean brightness is below ``threshold``.

    Args:
        image: an image from an earlier step.
        threshold: the brightness, 0 to 255, below which an image is dark.
    """
    return float(image.mean()) < threshold


# ─────────────────────────────────────────────────────────────────────────
# Changing an image — each returns a new image
# ─────────────────────────────────────────────────────────────────────────

@simple_step_tool(category="Images")
def to_grayscale(image: np.ndarray) -> np.ndarray:
    """The image in shades of grey.

    Args:
        image: an image from an earlier step.
    """
    grey = (image[..., :3] @ np.array([0.299, 0.587, 0.114])).round().astype(np.uint8)
    return np.stack([grey] * 3, axis=-1)


@simple_step_tool(category="Images")
def invert(image: np.ndarray) -> np.ndarray:
    """The image's negative: every colour flipped.

    Args:
        image: an image from an earlier step.
    """
    return (255 - image).astype(np.uint8)


@simple_step_tool(category="Images")
def thumbnail(image: np.ndarray, size: int = 32) -> np.ndarray:
    """The image shrunk to ``size`` × ``size`` pixels.

    Args:
        image: an image from an earlier step.
        size: the thumbnail's width and height, in pixels.
    """
    size = max(1, int(size))
    rows = np.linspace(0, image.shape[0] - 1, size).round().astype(int)
    cols = np.linspace(0, image.shape[1] - 1, size).round().astype(int)
    return image[rows][:, cols].astype(np.uint8)


@simple_step_tool(category="Images")
def film_strip(acc, thumb: np.ndarray) -> np.ndarray:
    """A reducer: the images side by side, in one strip.

    Run it with ``mod.collapse()`` over images of the same height, such as
    thumbnails.

    Args:
        acc: the strip so far.
        thumb: the next image to add.
    """
    return thumb if acc is None else np.concatenate([acc, thumb], axis=1)
