# Floor plan to SVG conversion

## Outputs

- [1F SVG](../web-app/assets/indoor/building1-1f.svg)
- [2F SVG](../web-app/assets/indoor/building1-2f.svg)

Live URLs:

- https://lyx493.github.io/neu-campus-navigation/assets/indoor/building1-1f.svg
- https://lyx493.github.io/neu-campus-navigation/assets/indoor/building1-2f.svg

## Skill

The reusable Codex skill is stored at:

```text
.agents/skills/floorplan-to-svg/
```

A portable archive is included as `floorplan-to-svg-skill.zip`.

## Method

ImageTracerJS 1.2.6 is used locally with jpeg-js decoding. The optimized floor-plan preset uses six colors, conservative path omission, curve fitting, and normalized SVG metadata. This produces editable vector paths while keeping stair symbols and room labels visible.

Recommended alternatives:

- VTracer for higher-fidelity color tracing.
- Potrace for clean black/white line art.
- OCR plus manually redrawn SVG text when editable room labels are required.

## QA

Both SVG files were rendered directly in GitHub Pages. Room labels, wall boundaries, stair symbols and the main corridor structure remain legible. The SVG text is traced into paths, not editable text.
