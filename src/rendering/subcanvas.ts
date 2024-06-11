import { WorkerProps } from "OffscreenShirt"
import { createScene } from "rendering/createScene"
import { dispatchEvent } from "rendering/dispatchEvent"
import { PerspectiveCamera, Scene } from "three"

export const addSubcanvas = (subcanvas: {
  id: string
  canvas: OffscreenCanvas
  x: number
  y: number
  width: number
  height: number
  props: WorkerProps
  proxy: HTMLElement
}) => {
  if (subcanvases[subcanvas.id]) {
    console.warn("overwriting canvas")
    return
  }
  const { scene, camera } = createScene(subcanvas.props, subcanvas.proxy)
  subcanvases[subcanvas.id] = {
    canvas: subcanvas.canvas,
    x: subcanvas.x,
    y: subcanvas.y,
    width: subcanvas.width,
    height: subcanvas.height,
    scene,
    camera,
  }
}

export const updateSubcanvas = (
  id: string,
  subcanvas: {
    x: number
    y: number
    width: number
    height: number
  }
) => {
  const target = subcanvases[id]
  if (!target) {
    throw new Error(`Canvas ${id} not found`)
  }
  // TODO fix jitter on resize
  target.canvas.width = subcanvas.width
  target.canvas.height = subcanvas.height

  target.x = subcanvas.x
  target.y = subcanvas.y
  target.width = subcanvas.width
  target.height = subcanvas.height
}

export const updateSubcanvasProps = (id: string, props: WorkerProps) => {
  const target = subcanvases[id]
  if (!target) {
    throw new Error(`Canvas ${id} not found`)
  }
  // TODO fix jitter on resize
  dispatchEvent(target.scene, { type: "updateProps", detail: { props: props, previous: undefined } })
}

export const removeSubcanvas = (id: string) => {
  const target = subcanvases[id]
  if (!target) {
    return
  }
  dispatchEvent(target.scene, { type: "destroy" })
  delete subcanvases[id]
}

export type Subcanvas = {
  canvas: OffscreenCanvas
  width: number
  height: number
  x: number
  y: number
  scene: Scene
  camera: PerspectiveCamera
}

export const getSubcanvas = (id: string): Subcanvas => {
  const target = subcanvases[id]
  if (!target) {
    throw new Error(`Canvas ${id} not found`)
  }
  return target
}

export const getSubcanvases = (): Array<Subcanvas & { id: string }> => {
  return Object.entries(subcanvases).map(([id, subcanvas]) => ({
    id,
    ...subcanvas,
  }))
}

const subcanvases: Record<string, Subcanvas> = {}
