"use client"

import React from "react"

import { useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Box, Sphere, Plane, Line } from "@react-three/drei"
import * as THREE from "three"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Play, Pause, RotateCcw, MapPin, Combine, Eye, EyeOff } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

interface CameraState {
  position: [number, number, number]
  rotation: [number, number, number]
  transformMatrix: number[][]
  movementMatrix: number[][]
  initialPosition: [number, number, number]
  initialRotation: [number, number, number]
  isAnimating: boolean
  boundaries: {
    min: [number, number, number]
    max: [number, number, number]
  }
}

interface MovementPreset {
  id: string
  name: string
  description: string
  category: "translation" | "rotation" | "complex"
  conflictsWith?: string[]
  matrix: number[][]
}

const MOVEMENT_PRESETS: MovementPreset[] = [
  // Translation presets
  {
    id: "forward",
    name: "Forward",
    description: "Move forward (negative Z)",
    category: "translation",
    conflictsWith: ["backward"],
    matrix: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, -0.02],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "backward",
    name: "Backward",
    description: "Move backward (positive Z)",
    category: "translation",
    conflictsWith: ["forward"],
    matrix: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0.02],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "left",
    name: "Left",
    description: "Move left (negative X)",
    category: "translation",
    conflictsWith: ["right"],
    matrix: [
      [1, 0, 0, -0.02],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "right",
    name: "Right",
    description: "Move right (positive X)",
    category: "translation",
    conflictsWith: ["left"],
    matrix: [
      [1, 0, 0, 0.02],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "up",
    name: "Up",
    description: "Move up (positive Y)",
    category: "translation",
    conflictsWith: ["down"],
    matrix: [
      [1, 0, 0, 0],
      [0, 1, 0, 0.02],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "down",
    name: "Down",
    description: "Move down (negative Y)",
    category: "translation",
    conflictsWith: ["up"],
    matrix: [
      [1, 0, 0, 0],
      [0, 1, 0, -0.02],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  // Rotation presets
  {
    id: "yaw-left",
    name: "Yaw Left",
    description: "Rotate left around Y-axis",
    category: "rotation",
    conflictsWith: ["yaw-right"],
    matrix: [
      [0.9998, 0, 0.02, 0],
      [0, 1, 0, 0],
      [-0.02, 0, 0.9998, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "yaw-right",
    name: "Yaw Right",
    description: "Rotate right around Y-axis",
    category: "rotation",
    conflictsWith: ["yaw-left"],
    matrix: [
      [0.9998, 0, -0.02, 0],
      [0, 1, 0, 0],
      [0.02, 0, 0.9998, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "pitch-up",
    name: "Pitch Up",
    description: "Look up around X-axis",
    category: "rotation",
    conflictsWith: ["pitch-down"],
    matrix: [
      [1, 0, 0, 0],
      [0, 0.9998, -0.02, 0],
      [0, 0.02, 0.9998, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "pitch-down",
    name: "Pitch Down",
    description: "Look down around X-axis",
    category: "rotation",
    conflictsWith: ["pitch-up"],
    matrix: [
      [1, 0, 0, 0],
      [0, 0.9998, 0.02, 0],
      [0, -0.02, 0.9998, 0],
      [0, 0, 0, 1],
    ],
  },
  // Complex preset
  {
    id: "spiral-up",
    name: "Spiral Up",
    description: "Rotate + move up + forward",
    category: "complex",
    matrix: [
      [0.999, 0, 0.045, 0],
      [0, 1, 0, 0.01],
      [-0.045, 0, 0.999, -0.01],
      [0, 0, 0, 1],
    ],
  },
]

// Identity matrix for comparison
const IDENTITY_MATRIX = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
]

function MatrixDisplay({ matrix, name, isResult = false }: { matrix: number[][]; name: string; isResult?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs mb-1 text-center">{name}</div>
      <div className="flex items-center">
        <div className="text-lg mr-1">[</div>
        <div className="grid grid-rows-4 gap-0.5">
          {matrix.map((row, i) => (
            <div key={i} className="flex gap-1">
              {row.map((val, j) => {
                const isIdentityValue = IDENTITY_MATRIX[i][j] === val
                const isDifferent = !isIdentityValue && !isResult
                return (
                  <div
                    key={j}
                    className={`text-xs px-1 py-0.5 rounded text-center min-w-[3rem] ${
                      isResult
                        ? "bg-green-900/40 text-green-200"
                        : isDifferent
                          ? "bg-yellow-600/60 text-yellow-100 font-semibold"
                          : "bg-gray-800/60 text-gray-300"
                    }`}
                  >
                    {val.toFixed(3)}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="text-lg ml-1">]</div>
      </div>
    </div>
  )
}

function MatrixCalculationDisplay({ selectedPresets }: { selectedPresets: string[] }) {
  const [isVisible, setIsVisible] = useState(true)

  if (selectedPresets.length === 0) return null

  const selectedPresetObjects = selectedPresets
    .map((id) => MOVEMENT_PRESETS.find((p) => p.id === id))
    .filter(Boolean) as MovementPreset[]

  // Sort by category: translation, rotation, complex
  const sortedPresets = selectedPresetObjects.sort((a, b) => {
    const order = { translation: 0, rotation: 1, complex: 2 }
    return order[a.category] - order[b.category]
  })

  // Calculate the result matrix step by step
  const currentMatrix = new THREE.Matrix4() // Identity matrix

  sortedPresets.forEach((preset) => {
    const presetMatrix = new THREE.Matrix4()
    presetMatrix.set(
      preset.matrix[0][0],
      preset.matrix[0][1],
      preset.matrix[0][2],
      preset.matrix[0][3],
      preset.matrix[1][0],
      preset.matrix[1][1],
      preset.matrix[1][2],
      preset.matrix[1][3],
      preset.matrix[2][0],
      preset.matrix[2][1],
      preset.matrix[2][2],
      preset.matrix[2][3],
      preset.matrix[3][0],
      preset.matrix[3][1],
      preset.matrix[3][2],
      preset.matrix[3][3],
    )
    currentMatrix.multiply(presetMatrix)
  })

  // Convert final result to array format
  const resultArray = currentMatrix.toArray()
  const resultMatrix = [
    [resultArray[0], resultArray[4], resultArray[8], resultArray[12]],
    [resultArray[1], resultArray[5], resultArray[9], resultArray[13]],
    [resultArray[2], resultArray[6], resultArray[10], resultArray[14]],
    [resultArray[3], resultArray[7], resultArray[11], resultArray[15]],
  ]

  return (
    <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm text-white rounded-lg border border-gray-600 max-w-4xl">
      <div className="flex items-center justify-between p-2 border-b border-gray-600">
        <div className="font-semibold text-sm text-yellow-300">Matrix Calculation</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
          className="h-6 w-6 p-0 text-gray-400 hover:text-white"
        >
          {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </Button>
      </div>

      {isVisible && (
        <div className="p-3">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {sortedPresets.map((preset, index) => (
              <React.Fragment key={preset.id}>
                <MatrixDisplay matrix={preset.matrix} name={preset.name} />
                {index < sortedPresets.length - 1 && <div className="text-gray-400 text-lg font-bold mx-2">×</div>}
              </React.Fragment>
            ))}

            <div className="text-gray-400 text-lg font-bold mx-3">=</div>

            <MatrixDisplay matrix={resultMatrix} name="Result" isResult={true} />
          </div>

          <div className="text-xs text-gray-400 mt-2 border-t border-gray-600 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-600/60 rounded"></div>
                <span>Changed from identity</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-800/60 rounded"></div>
                <span>Identity values</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-900/40 rounded"></div>
                <span>Final result</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CameraMatrixTool() {
  const [cameraState, setCameraState] = useState<CameraState>({
    position: [1.0, 2.0, 6.0],
    rotation: [0, 0, 0],
    transformMatrix: [
      [1, 0, 0, 1.0],
      [0, 1, 0, 2.0],
      [0, 0, 1, 6.0],
      [0, 0, 0, 1],
    ],
    movementMatrix: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
    initialPosition: [1.0, 2.0, 6.0],
    initialRotation: [0, 0, 0],
    isAnimating: false,
    boundaries: {
      min: [-8, 0.5, -8],
      max: [8, 6, 8],
    },
  })

  const [selectedPresets, setSelectedPresets] = useState<string[]>([])

  const [openSections, setOpenSections] = useState({
    controls: true,
    movement: false,
    presets: false,
    transform: false,
    boundaries: false,
  })

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const updateFromMatrix = () => {
    const matrix = new THREE.Matrix4()
    matrix.set(
      cameraState.transformMatrix[0][0],
      cameraState.transformMatrix[0][1],
      cameraState.transformMatrix[0][2],
      cameraState.transformMatrix[0][3],
      cameraState.transformMatrix[1][0],
      cameraState.transformMatrix[1][1],
      cameraState.transformMatrix[1][2],
      cameraState.transformMatrix[1][3],
      cameraState.transformMatrix[2][0],
      cameraState.transformMatrix[2][1],
      cameraState.transformMatrix[2][2],
      cameraState.transformMatrix[2][3],
      cameraState.transformMatrix[3][0],
      cameraState.transformMatrix[3][1],
      cameraState.transformMatrix[3][2],
      cameraState.transformMatrix[3][3],
    )

    const position = new THREE.Vector3()
    const rotation = new THREE.Euler()
    const scale = new THREE.Vector3()
    matrix.decompose(position, new THREE.Quaternion().setFromEuler(rotation), scale)

    setCameraState((prev) => ({
      ...prev,
      position: [position.x, position.y, position.z],
      rotation: [rotation.x, rotation.y, rotation.z],
    }))
  }

  const updateFromPositionRotation = () => {
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3(...cameraState.position)
    const rotation = new THREE.Euler(...cameraState.rotation)

    matrix.makeRotationFromEuler(rotation)
    matrix.setPosition(position)

    const matrixArray = matrix.toArray()
    const transformMatrix = [
      [matrixArray[0], matrixArray[4], matrixArray[8], matrixArray[12]],
      [matrixArray[1], matrixArray[5], matrixArray[9], matrixArray[13]],
      [matrixArray[2], matrixArray[6], matrixArray[10], matrixArray[14]],
      [matrixArray[3], matrixArray[7], matrixArray[11], matrixArray[15]],
    ]

    setCameraState((prev) => ({ ...prev, transformMatrix }))
  }

  const resetCamera = () => {
    setCameraState((prev) => ({
      ...prev,
      position: [...prev.initialPosition],
      rotation: [...prev.initialRotation],
      isAnimating: false,
    }))

    // Also reset the transform matrix to match the initial position
    setTimeout(() => {
      const matrix = new THREE.Matrix4()
      const position = new THREE.Vector3(...cameraState.initialPosition)
      const rotation = new THREE.Euler(...cameraState.initialRotation)

      matrix.makeRotationFromEuler(rotation)
      matrix.setPosition(position)

      const matrixArray = matrix.toArray()
      const transformMatrix = [
        [matrixArray[0], matrixArray[4], matrixArray[8], matrixArray[12]],
        [matrixArray[1], matrixArray[5], matrixArray[9], matrixArray[13]],
        [matrixArray[2], matrixArray[6], matrixArray[10], matrixArray[14]],
        [matrixArray[3], matrixArray[7], matrixArray[11], matrixArray[15]],
      ]

      setCameraState((prev) => ({ ...prev, transformMatrix }))
    }, 0)
  }

  const setInitialPosition = () => {
    setCameraState((prev) => ({
      ...prev,
      initialPosition: [...prev.position],
      initialRotation: [...prev.rotation],
    }))
  }

  const toggleAnimation = () => {
    setCameraState((prev) => ({ ...prev, isAnimating: !prev.isAnimating }))
  }

  const togglePreset = (presetId: string) => {
    const preset = MOVEMENT_PRESETS.find((p) => p.id === presetId)
    if (!preset) return

    setSelectedPresets((prev) => {
      let newSelection = [...prev]

      if (newSelection.includes(presetId)) {
        // Remove if already selected
        newSelection = newSelection.filter((id) => id !== presetId)
      } else {
        // Add and remove conflicts
        if (preset.conflictsWith) {
          newSelection = newSelection.filter((id) => !preset.conflictsWith!.includes(id))
        }
        newSelection.push(presetId)
      }

      return newSelection
    })
  }

  const combineSelectedPresets = () => {
    if (selectedPresets.length === 0) {
      // Identity matrix
      setCameraState((prev) => ({
        ...prev,
        movementMatrix: [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ],
      }))
      return
    }

    // Start with identity matrix
    const combinedMatrix = new THREE.Matrix4()

    // Multiply selected matrices in order: translations first, then rotations, then complex
    const selectedPresetObjects = selectedPresets
      .map((id) => MOVEMENT_PRESETS.find((p) => p.id === id))
      .filter(Boolean) as MovementPreset[]

    // Sort by category: translation, rotation, complex
    const sortedPresets = selectedPresetObjects.sort((a, b) => {
      const order = { translation: 0, rotation: 1, complex: 2 }
      return order[a.category] - order[b.category]
    })

    sortedPresets.forEach((preset) => {
      const presetMatrix = new THREE.Matrix4()
      presetMatrix.set(
        preset.matrix[0][0],
        preset.matrix[0][1],
        preset.matrix[0][2],
        preset.matrix[0][3],
        preset.matrix[1][0],
        preset.matrix[1][1],
        preset.matrix[1][2],
        preset.matrix[1][3],
        preset.matrix[2][0],
        preset.matrix[2][1],
        preset.matrix[2][2],
        preset.matrix[2][3],
        preset.matrix[3][0],
        preset.matrix[3][1],
        preset.matrix[3][2],
        preset.matrix[3][3],
      )
      combinedMatrix.multiply(presetMatrix)
    })

    // Convert back to array format
    const matrixArray = combinedMatrix.toArray()
    const newMovementMatrix = [
      [matrixArray[0], matrixArray[4], matrixArray[8], matrixArray[12]],
      [matrixArray[1], matrixArray[5], matrixArray[9], matrixArray[13]],
      [matrixArray[2], matrixArray[6], matrixArray[10], matrixArray[14]],
      [matrixArray[3], matrixArray[7], matrixArray[11], matrixArray[15]],
    ]

    setCameraState((prev) => ({ ...prev, movementMatrix: newMovementMatrix }))
  }

  const clearSelection = () => {
    setSelectedPresets([])
    setCameraState((prev) => ({
      ...prev,
      movementMatrix: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    }))
  }

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-sky-400 via-sky-200 to-white">
      {/* Main Camera View */}
      <div className="w-full h-full">
        <Canvas camera={{ position: cameraState.position, fov: 75 }}>
          <MainCameraView cameraState={cameraState} setCameraState={setCameraState} />
        </Canvas>
      </div>

      {/* Mini Overview */}
      <div className="absolute top-4 right-4 w-64 h-48 border-2 border-white rounded-lg overflow-hidden bg-black/20 backdrop-blur-sm">
        <Canvas camera={{ position: [12, 10, 12], fov: 50 }}>
          <OverviewScene cameraState={cameraState} />
        </Canvas>
      </div>

      {/* Control Panel */}
      <div className="absolute top-4 left-4 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
        <Card className="bg-black/80 backdrop-blur-sm text-white border-gray-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Camera Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Animation Controls */}
            <div className="flex items-center justify-between p-2 bg-gray-800/80 rounded">
              <div className="flex items-center gap-2">
                {cameraState.isAnimating ? <Play className="w-4 h-4 text-red-500" /> : <Pause className="w-4 h-4" />}
                <Label className="text-sm font-medium">Animation</Label>
              </div>
              <Switch checked={cameraState.isAnimating} onCheckedChange={toggleAnimation} />
            </div>

            <div className="flex gap-2">
              <Button onClick={setInitialPosition} size="sm" className="flex-1 bg-green-600 hover:bg-green-700">
                <MapPin className="w-3 h-3 mr-1" />
                Set Initial
              </Button>
              <Button onClick={resetCamera} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>

            {/* Basic Controls */}
            <Collapsible open={openSections.controls} onOpenChange={() => toggleSection("controls")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-gray-800/80 rounded hover:bg-gray-700/80">
                <span className="text-sm font-medium">Position & Rotation</span>
                {openSections.controls ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3">
                <div>
                  <Label className="text-xs text-gray-300 mb-1 block">Position (X, Y, Z)</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {cameraState.position.map((val, i) => (
                      <NumberInput
                        key={i}
                        value={val}
                        onChange={(newVal) => {
                          const newPos = [...cameraState.position] as [number, number, number]
                          newPos[i] = newVal
                          setCameraState((prev) => ({ ...prev, position: newPos }))
                          setTimeout(updateFromPositionRotation, 0)
                        }}
                        disabled={cameraState.isAnimating}
                        step={0.1}
                        precision={1}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-300 mb-1 block">Rotation (X, Y, Z) - Radians</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {cameraState.rotation.map((val, i) => (
                      <NumberInput
                        key={i}
                        value={val}
                        onChange={(newVal) => {
                          const newRot = [...cameraState.rotation] as [number, number, number]
                          newRot[i] = newVal
                          setCameraState((prev) => ({ ...prev, rotation: newRot }))
                          setTimeout(updateFromPositionRotation, 0)
                        }}
                        disabled={cameraState.isAnimating}
                        step={0.1}
                        precision={2}
                      />
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Movement Builder */}
            <Collapsible open={openSections.presets} onOpenChange={() => toggleSection("presets")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-gray-800/80 rounded hover:bg-gray-700/80">
                <span className="text-sm font-medium">Movement Builder</span>
                {openSections.presets ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3">
                {/* Translation */}
                <div>
                  <Label className="text-xs text-gray-300 mb-2 block font-semibold">Translation</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {MOVEMENT_PRESETS.filter((p) => p.category === "translation").map((preset) => (
                      <div key={preset.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={preset.id}
                          checked={selectedPresets.includes(preset.id)}
                          onCheckedChange={() => togglePreset(preset.id)}
                        />
                        <Label htmlFor={preset.id} className="text-xs cursor-pointer">
                          {preset.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rotation */}
                <div>
                  <Label className="text-xs text-gray-300 mb-2 block font-semibold">Rotation</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {MOVEMENT_PRESETS.filter((p) => p.category === "rotation").map((preset) => (
                      <div key={preset.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={preset.id}
                          checked={selectedPresets.includes(preset.id)}
                          onCheckedChange={() => togglePreset(preset.id)}
                        />
                        <Label htmlFor={preset.id} className="text-xs cursor-pointer">
                          {preset.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Complex */}
                <div>
                  <Label className="text-xs text-gray-300 mb-2 block font-semibold">Complex</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {MOVEMENT_PRESETS.filter((p) => p.category === "complex").map((preset) => (
                      <div key={preset.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={preset.id}
                          checked={selectedPresets.includes(preset.id)}
                          onCheckedChange={() => togglePreset(preset.id)}
                        />
                        <Label htmlFor={preset.id} className="text-xs cursor-pointer">
                          {preset.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={combineSelectedPresets}
                    size="sm"
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Combine className="w-3 h-3 mr-1" />
                    Combine ({selectedPresets.length})
                  </Button>
                  <Button
                    onClick={clearSelection}
                    size="sm"
                    variant="outline"
                    className="bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 text-white"
                  >
                    Clear
                  </Button>
                </div>

                <p className="text-xs text-gray-400">
                  Select movements to combine. Conflicting movements (like forward + backward) are automatically
                  handled.
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* Movement Matrix */}
            <Collapsible open={openSections.movement} onOpenChange={() => toggleSection("movement")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-gray-800/80 rounded hover:bg-gray-700/80">
                <span className="text-sm font-medium">Movement Matrix</span>
                {openSections.movement ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="grid grid-cols-4 gap-1">
                  {cameraState.movementMatrix.map((row, i) =>
                    row.map((val, j) => (
                      <NumberInput
                        key={`move-${i}-${j}`}
                        value={val}
                        onChange={(newVal) => {
                          const newMatrix = cameraState.movementMatrix.map((r) => [...r])
                          newMatrix[i][j] = newVal
                          setCameraState((prev) => ({ ...prev, movementMatrix: newMatrix }))
                        }}
                        step={0.001}
                        precision={3}
                        className="text-xs"
                      />
                    )),
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-2 space-y-1">
                  <p>• Top-left 3×3: Rotation & scaling</p>
                  <p>• Right column: Translation (X,Y,Z)</p>
                  <p>• Bottom row: Usually [0,0,0,1]</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Transform Matrix */}
            <Collapsible open={openSections.transform} onOpenChange={() => toggleSection("transform")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-gray-800/80 rounded hover:bg-gray-700/80">
                <span className="text-sm font-medium">Current Transform Matrix</span>
                {openSections.transform ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="grid grid-cols-4 gap-1">
                  {cameraState.transformMatrix.map((row, i) =>
                    row.map((val, j) => (
                      <NumberInput
                        key={`${i}-${j}`}
                        value={val}
                        onChange={(newVal) => {
                          const newMatrix = cameraState.transformMatrix.map((r) => [...r])
                          newMatrix[i][j] = newVal
                          setCameraState((prev) => ({ ...prev, transformMatrix: newMatrix }))
                          setTimeout(updateFromMatrix, 0)
                        }}
                        disabled={cameraState.isAnimating}
                        step={0.01}
                        precision={2}
                        className="text-xs"
                      />
                    )),
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">Camera's current world transformation</p>
              </CollapsibleContent>
            </Collapsible>

            {/* Boundaries */}
            <Collapsible open={openSections.boundaries} onOpenChange={() => toggleSection("boundaries")}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-gray-800/80 rounded hover:bg-gray-700/80">
                <span className="text-sm font-medium">Scene Boundaries</span>
                {openSections.boundaries ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                <div>
                  <Label className="text-xs text-gray-300 mb-1 block">Min (X, Y, Z)</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {cameraState.boundaries.min.map((val, i) => (
                      <NumberInput
                        key={`min-${i}`}
                        value={val}
                        onChange={(newVal) => {
                          const newMin = [...cameraState.boundaries.min] as [number, number, number]
                          newMin[i] = newVal
                          setCameraState((prev) => ({
                            ...prev,
                            boundaries: { ...prev.boundaries, min: newMin },
                          }))
                        }}
                        step={0.5}
                        precision={1}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-300 mb-1 block">Max (X, Y, Z)</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {cameraState.boundaries.max.map((val, i) => (
                      <NumberInput
                        key={`max-${i}`}
                        value={val}
                        onChange={(newVal) => {
                          const newMax = [...cameraState.boundaries.max] as [number, number, number]
                          newMax[i] = newVal
                          setCameraState((prev) => ({
                            ...prev,
                            boundaries: { ...prev.boundaries, max: newMax },
                          }))
                        }}
                        step={0.5}
                        precision={1}
                      />
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>

      {/* Matrix Calculation Display */}
      <MatrixCalculationDisplay selectedPresets={selectedPresets} />

      <style jsx global>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.5) rgba(0, 0, 0, 0.1);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.5);
          border-radius: 4px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.7);
        }

        .custom-scrollbar::-webkit-scrollbar-corner {
          background: rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  )
}

// Custom NumberInput component to handle input properly
function NumberInput({
  value,
  onChange,
  disabled = false,
  step = 0.1,
  precision = 2,
  className = "",
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  step?: number
  precision?: number
  className?: string
}) {
  const [localValue, setLocalValue] = useState(value.toFixed(precision))
  const [isFocused, setIsFocused] = useState(false)

  // Update local value when prop changes (but not when focused)
  React.useEffect(() => {
    if (!isFocused) {
      setLocalValue(value.toFixed(precision))
    }
  }, [value, precision, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }

  const handleBlur = () => {
    setIsFocused(false)
    const numValue = Number.parseFloat(localValue)
    if (!Number.isNaN(numValue)) {
      onChange(numValue)
    } else {
      setLocalValue(value.toFixed(precision))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur()
    }
  }

  return (
    <Input
      type="text"
      value={localValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={`bg-gray-800/80 border-gray-600 text-white p-1 h-7 ${className}`}
    />
  )
}

function MainCameraView({
  cameraState,
  setCameraState,
}: {
  cameraState: CameraState
  setCameraState: React.Dispatch<React.SetStateAction<CameraState>>
}) {
  const { camera, scene } = useThree()

  // Set up sky gradient background
  React.useEffect(() => {
    scene.background = new THREE.Color(0x87ceeb) // Sky blue
  }, [scene])

  useFrame(() => {
    if (cameraState.isAnimating) {
      const currentMatrix = new THREE.Matrix4()
      currentMatrix.set(
        cameraState.transformMatrix[0][0],
        cameraState.transformMatrix[0][1],
        cameraState.transformMatrix[0][2],
        cameraState.transformMatrix[0][3],
        cameraState.transformMatrix[1][0],
        cameraState.transformMatrix[1][1],
        cameraState.transformMatrix[1][2],
        cameraState.transformMatrix[1][3],
        cameraState.transformMatrix[2][0],
        cameraState.transformMatrix[2][1],
        cameraState.transformMatrix[2][2],
        cameraState.transformMatrix[2][3],
        cameraState.transformMatrix[3][0],
        cameraState.transformMatrix[3][1],
        cameraState.transformMatrix[3][2],
        cameraState.transformMatrix[3][3],
      )

      const movementMatrix = new THREE.Matrix4()
      movementMatrix.set(
        cameraState.movementMatrix[0][0],
        cameraState.movementMatrix[0][1],
        cameraState.movementMatrix[0][2],
        cameraState.movementMatrix[0][3],
        cameraState.movementMatrix[1][0],
        cameraState.movementMatrix[1][1],
        cameraState.movementMatrix[1][2],
        cameraState.movementMatrix[1][3],
        cameraState.movementMatrix[2][0],
        cameraState.movementMatrix[2][1],
        cameraState.movementMatrix[2][2],
        cameraState.movementMatrix[2][3],
        cameraState.movementMatrix[3][0],
        cameraState.movementMatrix[3][1],
        cameraState.movementMatrix[3][2],
        cameraState.movementMatrix[3][3],
      )

      currentMatrix.multiply(movementMatrix)

      const position = new THREE.Vector3()
      const quaternion = new THREE.Quaternion()
      const scale = new THREE.Vector3()
      currentMatrix.decompose(position, quaternion, scale)

      const rotation = new THREE.Euler().setFromQuaternion(quaternion)

      const { min, max } = cameraState.boundaries
      const shouldReset =
        position.x < min[0] ||
        position.x > max[0] ||
        position.y < min[1] ||
        position.y > max[1] ||
        position.z < min[2] ||
        position.z > max[2]

      if (shouldReset) {
        setCameraState((prev) => ({
          ...prev,
          position: [...prev.initialPosition],
          rotation: [...prev.initialRotation],
        }))
      } else {
        const matrixArray = currentMatrix.toArray()
        const newTransformMatrix = [
          [matrixArray[0], matrixArray[4], matrixArray[8], matrixArray[12]],
          [matrixArray[1], matrixArray[5], matrixArray[9], matrixArray[13]],
          [matrixArray[2], matrixArray[6], matrixArray[10], matrixArray[14]],
          [matrixArray[3], matrixArray[7], matrixArray[11], matrixArray[15]],
        ]

        setCameraState((prev) => ({
          ...prev,
          position: [position.x, position.y, position.z],
          rotation: [rotation.x, rotation.y, rotation.z],
          transformMatrix: newTransformMatrix,
        }))
      }
    }

    camera.position.set(...cameraState.position)
    camera.rotation.set(...cameraState.rotation)
  })

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} color="#fff8dc" />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} color="#87ceeb" />
      <SceneObjects />
    </>
  )
}

function OverviewScene({ cameraState }: { cameraState: CameraState }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <OrbitControls enablePan={false} enableZoom={false} />
      <SceneObjects />
      <CameraVisualization cameraState={cameraState} />
      <BoundaryVisualization boundaries={cameraState.boundaries} />
      <gridHelper args={[20, 20, "#444", "#222"]} />
    </>
  )
}

function CameraVisualization({ cameraState }: { cameraState: CameraState }) {
  const cameraRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (cameraRef.current) {
      cameraRef.current.position.set(...cameraState.position)
      cameraRef.current.rotation.set(...cameraState.rotation)
    }
  })

  const frustumPoints = [
    [0, 0, 0],
    [1, 0.75, -2],
    [0, 0, 0],
    [-1, 0.75, -2],
    [0, 0, 0],
    [1, -0.75, -2],
    [0, 0, 0],
    [-1, -0.75, -2],
    [1, 0.75, -2],
    [-1, 0.75, -2],
    [-1, 0.75, -2],
    [-1, -0.75, -2],
    [-1, -0.75, -2],
    [1, -0.75, -2],
    [1, -0.75, -2],
    [1, 0.75, -2],
  ]

  const color = cameraState.isAnimating ? "#e74c3c" : "#4a90e2"

  return (
    <group ref={cameraRef}>
      <Box args={[0.3, 0.2, 0.4]} position={[0, 0, 0]}>
        <meshStandardMaterial color={color} />
      </Box>
      <Sphere args={[0.1]} position={[0, 0, -0.25]}>
        <meshStandardMaterial color="#2c3e50" />
      </Sphere>
      <Box args={[0.05, 0.05, 1]} position={[0, 0, -1]}>
        <meshStandardMaterial color={color} />
      </Box>
      <Line points={frustumPoints} color={color} lineWidth={2} transparent opacity={0.6} />
    </group>
  )
}

function BoundaryVisualization({ boundaries }: { boundaries: CameraState["boundaries"] }) {
  const { min, max } = boundaries
  const boundaryPoints = [
    [min[0], min[1], min[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], min[1], max[2]],
    [min[0], min[1], max[2]],
    [min[0], min[1], max[2]],
    [min[0], min[1], min[2]],
    [min[0], max[1], min[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]],
    [max[0], max[1], max[2]],
    [min[0], max[1], max[2]],
    [min[0], max[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], min[1], min[2]],
    [min[0], max[1], min[2]],
    [max[0], min[1], min[2]],
    [max[0], max[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], max[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], max[2]],
  ]
  return <Line points={boundaryPoints} color="#ffff00" lineWidth={1} transparent opacity={0.3} />
}

function SceneObjects() {
  return (
    <>
      <Plane args={[20, 20]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <meshStandardMaterial color="#228b22" />
      </Plane>
      <Box args={[1, 1, 1]} position={[2, 0, -2]}>
        <meshStandardMaterial color="#dc143c" />
      </Box>
      <Sphere args={[0.8]} position={[-2, 0.8, -1]}>
        <meshStandardMaterial color="#32cd32" />
      </Sphere>
      <Box args={[0.5, 3, 0.5]} position={[0, 1.5, -4]}>
        <meshStandardMaterial color="#ffa500" />
      </Box>
      <Sphere args={[0.5]} position={[3, 0.5, 1]}>
        <meshStandardMaterial color="#9370db" />
      </Sphere>
      <Box args={[1.5, 0.2, 1.5]} position={[-3, 0.1, -3]}>
        <meshStandardMaterial color="#20b2aa" />
      </Box>
      <Box args={[0.8, 2, 0.8]} position={[-1, 1, 3]}>
        <meshStandardMaterial color="#2f4f4f" />
      </Box>
      <Sphere args={[0.6]} position={[4, 0.6, -3]}>
        <meshStandardMaterial color="#ff6347" />
      </Sphere>
    </>
  )
}
