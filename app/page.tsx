import type { Metadata } from "next"
import CameraMatrixTool from "../camera-matrix-tool"

export const metadata: Metadata = {
  title: "3D Camera Matrix Transformation Tool",
  description:
    "Interactive 3D visualization tool for learning camera transformations, matrix operations, rotations, and translations in real-time with Three.js",
  keywords: "3D, matrix, transformation, camera, Three.js, rotation, translation, visualization, interactive",
}

export default function Page() {
  return <CameraMatrixTool />
}
