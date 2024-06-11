// main.jsx (main thread)

import { Dispatch, useEffect, useRef, useState } from "react"
import { ShirtProps } from "Shirt"

const prepareMouseEvent = (e: MouseEvent) => {
  const keepKeys = [
    "ctrlKey",
    "metaKey",
    "shiftKey",
    "button",
    "clientX",
    "clientY",
    "pageX",
    "pageY",
    "screenX",
    "screenY",
    "offsetX",
    "offsetY",
    "layerX",
    "layerY",
    "type",
    "x",
    "y",
    "timeStamp",
    "isPrimary",
    "pointerType",
  ]

  const entries: Array<[string, unknown]> = []
  for (const entry in e) {
    entries.push([entry, (e as unknown as Record<string, unknown>)[entry]])
  }
  const filteredEntries = entries.filter(([key]) => keepKeys.includes(key))
  const filteredEvent = Object.fromEntries(filteredEntries)
  return filteredEvent
}

export type WorkerProps = {
  /** An url to an image that is printed onto the shirt */
  motif?: string
  /** The shirt color */
  color: string
  /** How much the camera wobbles */
  wobbleRange?: number
  /** How fast the camera wobbles */
  wobbleSpeed?: number
  /** Disable interaction */
  disabled: boolean
  /** Scale the decal size by this factor */
  decalScale: number
  /** Set the vertical baseline of the decal (shift it up or down) */
  decalBaseline: number
}

export type InitMessage = {
  canvas: OffscreenCanvas
  width: number
  height: number
  x: number
  y: number
  pixelRatio: number
  props: WorkerProps
  type: "init"
  canvasId: string
}

export type MoveMessage = {
  width: number
  height: number
  x: number
  y: number
  type: "move"
  canvasId: string
}

export type WindowInfoMessage = {
  width: number
  height: number
  type: "windowInfo"
}

export type DestroyMessage = {
  type: "destroy"
  canvasId: string
}

export type UpdatePropsMessage = {
  props: WorkerProps
  type: "updateProps"
  canvasId: string
}

export type InteractionMessage = {
  event: Record<string, unknown>
  type: "interaction"
  /** String for poiner up and down to a specific canvas, undefined for moves */
  canvasId: string | undefined
}

export type UpdateTextureMessage = {
  texture: ImageBitmap
  url: string
  type: "updateTexture"
}

export type ShirtReadyMessage = {
  type: "setShirtReady"
  value: boolean
  canvasId: string
}

export type CanvasReadyMessage = {
  type: "setCanvasReady"
  value: boolean
  canvasId: string
}

export type DecalReadyMessage = {
  type: "setDecalReady"
  value: boolean
  error: boolean
  hasPrevious: boolean
  canvasId: string
}

export type OffscreenShirtCanvasProps = {
  worker: Worker
  setShirtReady: Dispatch<boolean>
  setDecalReady: Dispatch<boolean>
  setPreviousDecalReady: Dispatch<boolean>
  setCanvasReady: Dispatch<boolean>
} & ShirtProps

const texturePromises: Record<string, Promise<ImageBitmap>> = {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const loadTextureAsync = (url: string) => {
  if (!url) {
    throw new Error("Url needs to be defined")
  }

  if (!texturePromises[url]) {
    texturePromises[url] = new Promise<ImageBitmap>((resolve, reject) => {
      try {
        const image = new Image()
        image.onload = async () => {
          try {
            console.timeEnd("load texture into image")
            console.time("create bitmap texture")
            const bitmap = await createImageBitmap(image)
            console.timeEnd("create bitmap texture")
            resolve(bitmap)
          } catch (e) {
            reject(e)
          }
        }
        console.time("load texture into image")
        image.src = url
      } catch (e) {
        reject(e)
      }
    })
  }

  return texturePromises[url]
}

const uploadedTextures: Record<string, boolean | undefined> = {}
const uploadTexture = async (url: string, worker: Worker) => {
  if (!url) {
    throw new Error("Url needs to be defined")
  }
  if (uploadedTextures[url]) {
    return
  }

  const texture = await loadTextureAsync(url)
  if (!texture) {
    throw new Error("texture not found" + url)
  }
  const updateTextureMessage: UpdateTextureMessage = {
    type: "updateTexture",
    url: url,
    texture,
  }

  if (uploadedTextures[url]) {
    return
  }
  worker.postMessage(updateTextureMessage, [texture])
  uploadedTextures[url] = true
}

export const OffscreenShirtCanvas = ({
  worker,
  motif,
  color = "#202020",
  wobbleRange,
  wobbleSpeed,
  disabled,
  motifScale,
  motifBaseline,
  setShirtReady,
  setDecalReady,
  setPreviousDecalReady,
  setCanvasReady,
}: OffscreenShirtCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenCanvasRef = useRef<OffscreenCanvas>()
  const initRef = useRef<boolean>(false)

  // Ensure window resize observer
  useEffect(() => {
    // @ts-expect-error: We stick the window observer to the worker to prevent it from being garbage collected and to make sure we only have one observer per worker
    if (worker && !worker["resizeObserver"]) {
      // TODO: Check that this is only called once on initializiation
      const updateWindowInfo = () => {
        const windowResizeMessage: WindowInfoMessage = {
          type: "windowInfo",
          width: window.innerWidth, //entry.contentRect.width,
          height: window.innerHeight, //entry.contentRect.height,
        }
        worker.postMessage(windowResizeMessage)
      }

      const observer = new ResizeObserver(entries => {
        const entry = entries[0]
        if (!entry) {
          throw new Error("no entry?")
        }
        updateWindowInfo()
      })

      // Update window info on initial load to initialize
      // updateWindowInfo()

      // @ts-expect-error: We stick the window observer to the worker to prevent it from being garbage collected and to make sure we only have one observer per worker
      worker["resizeObserver"] = observer
      observer.observe(document.body)
    }
  }, [worker])

  // Add canvas resize Observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    if (!worker) {
      return
    }
    const updatePosition = () => {
      const rect = canvas.getBoundingClientRect()
      const moveMessage: MoveMessage = {
        type: "move",
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        canvasId: canvas.id,
      }
      worker.postMessage(moveMessage)
    }
    const observer = new ResizeObserver(() => {
      updatePosition()
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [worker])

  // Relay shirt ready state
  useEffect(() => {
    const listener = (event: MessageEvent<CanvasReadyMessage | DecalReadyMessage | ShirtReadyMessage>) => {
      if (event.data.type !== "setShirtReady") {
        return
      }
      if (event.data.canvasId !== canvasRef.current?.id) {
        return
      }
      setShirtReady(event.data.value)
    }

    worker.addEventListener("message", listener)
    return () => worker.removeEventListener("message", listener)
  }, [setShirtReady, worker])

  // Relay canvas ready state
  useEffect(() => {
    const listener = (event: MessageEvent<CanvasReadyMessage | DecalReadyMessage | ShirtReadyMessage>) => {
      if (event.data.type !== "setCanvasReady") {
        return
      }
      if (event.data.canvasId !== canvasRef.current?.id) {
        return
      }
      setCanvasReady(event.data.value)
    }

    worker.addEventListener("message", listener)
    return () => worker.removeEventListener("message", listener)
  }, [setCanvasReady, worker])

  // Relay decal ready state
  useEffect(() => {
    const listener = (event: MessageEvent<CanvasReadyMessage | DecalReadyMessage | ShirtReadyMessage>) => {
      if (event.data.type !== "setDecalReady") {
        return
      }
      if (event.data.canvasId !== canvasRef.current?.id) {
        return
      }
      setDecalReady(event.data.value)
      setPreviousDecalReady(event.data.hasPrevious)
    }

    worker.addEventListener("message", listener)
    return () => worker.removeEventListener("message", listener)
  }, [setDecalReady, setPreviousDecalReady, worker])

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) {
      throw new Error("shouldnt happen 1")
    }
    if (!canvasRef.current.id) {
      canvasRef.current.id = new Array(30)
        .fill(0)
        .map(() => Math.random().toString(36)[2])
        .join("")
    }

    const offscreenCanvas = offscreenCanvasRef.current ?? canvasRef.current?.transferControlToOffscreen()
    if (!offscreenCanvas) {
      throw new Error("shouldnt happen 2")
    }

    offscreenCanvasRef.current = offscreenCanvas

    if (initRef.current) {
      return
    }
    const rect = canvasRef.current.getBoundingClientRect()
    const initMessage: InitMessage = {
      canvas: offscreenCanvas,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
      pixelRatio: window.devicePixelRatio,
      type: "init",
      props: {
        motif: motif,
        color: color,
        wobbleRange: wobbleRange,
        wobbleSpeed: wobbleSpeed,
        disabled: !!disabled,
        decalScale: motifScale ?? 1,
        decalBaseline: motifBaseline ?? 0,
      },
      canvasId: canvasRef.current.id,
    }
    worker.postMessage(initMessage, [offscreenCanvas])
    initRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker])

  // Destroy canvas
  const gcIntervalRef = useRef<NodeJS.Timer>()
  const id = canvasRef.current?.id
  useEffect(() => {
    if (!id) {
      return
    }
    if (gcIntervalRef.current) {
      clearInterval(gcIntervalRef.current)
    }
    return () => {
      const destroyCanvas = () => {
        if (!document.getElementById(id)) {
          console.log("destroying canvas" + id)
          const destroyMessage: DestroyMessage = {
            type: "destroy",
            canvasId: id,
          }
          worker.postMessage(destroyMessage)
          clearInterval(gcInterval)
        }
      }
      const gcInterval = setInterval(() => {
        destroyCanvas
      }, 2000)
      destroyCanvas()
      gcIntervalRef.current = gcInterval
    }
  }, [id, worker])

  // Update canvas props
  useEffect(() => {
    if (!initRef.current) {
      return
    }
    if (!canvasRef?.current?.id) {
      return
    }
    const updatePropsMessage: UpdatePropsMessage = {
      type: "updateProps",
      props: {
        motif: motif,
        color: color,
        wobbleRange: wobbleRange,
        wobbleSpeed: wobbleSpeed,
        disabled: !!disabled,
        decalScale: motifScale ?? 1,
        decalBaseline: motifBaseline ?? 0,
      },
      canvasId: canvasRef?.current?.id,
    }
    worker.postMessage(updatePropsMessage)
  }, [worker, motif, color, wobbleRange, wobbleSpeed, disabled, motifScale, motifBaseline])

  // Upload texture
  useEffect(() => {
    if (!initRef.current) {
      return
    }
    if (!motif) {
      return
    }
    uploadTexture(motif, worker)
  }, [worker, motif])

  return (
    <canvas
      onClick={e => {
        console.log("click")
        const message: InteractionMessage = {
          event: prepareMouseEvent(e.nativeEvent),
          type: "interaction",
          canvasId: e.currentTarget.id,
        }
        worker.postMessage(message)
      }}
      onPointerDown={e => {
        console.log("click")
        const message: InteractionMessage = {
          event: prepareMouseEvent(e.nativeEvent),
          type: "interaction",
          canvasId: e.currentTarget.id,
        }
        worker.postMessage(message)
      }}
      onPointerMove={e => {
        const message: InteractionMessage = {
          event: prepareMouseEvent(e.nativeEvent),
          type: "interaction",
          canvasId: e.currentTarget.id,
        }
        worker.postMessage(message)
      }}
      onPointerUp={e => {
        const message: InteractionMessage = {
          event: prepareMouseEvent(e.nativeEvent),
          type: "interaction",
          canvasId: e.currentTarget.id,
        }
        worker.postMessage(message)
      }}
      style={{
        width: "100%",
        height: "100%",
        zIndex: 3,
      }}
      height={800}
      width={664}
      ref={canvasRef}
    />
  )
}

export type OffscreenShirtProps = {
  /** A webworker that has processEvent as the handler for messages. Will only display cover until the worker is set */
  worker?: Worker
} & ShirtProps

export const OffscreenShirt = ({
  worker,
  motif,
  color = "#202020",
  wobbleRange,
  wobbleSpeed,
  disabled,
  cover,
  coverLoading,
  coverMotifChange,
  motifScale,
  motifBaseline,
  className,
  renderDelay,
}: OffscreenShirtProps) => {
  const [decalReady, setDecalReady] = useState<boolean>(false)
  const [previousDecalReady, setPreviousDecalReady] = useState<boolean>(false)

  const [canvasReady, setCanvasReady] = useState<boolean>(false)

  const [shirtReady, setShirtReady] = useState<boolean>(false)

  const [delayReady, setDelayReady] = useState(!renderDelay)

  useEffect(() => {
    if (renderDelay) {
      const timeout = setTimeout(() => {
        setDelayReady(true)
      }, renderDelay)
      return () => clearTimeout(timeout)
    }
  }, [renderDelay, setDelayReady])

  const coverElement = (
    <div style={{ background: "transparent", position: "absolute", width: "100%", height: "100%", zIndex: "1" }}>
      {cover}
    </div>
  )

  const ready =
    !!worker &&
    shirtReady &&
    canvasReady &&
    (decalReady || previousDecalReady || !coverLoading) &&
    (decalReady || !coverMotifChange) &&
    delayReady

  return (
    <div
      style={{ background: "transparent", position: "relative", width: "100%", height: "100%" }}
      className={`${className}`}
    >
      {/* {ready ? null : coverElement} */}
      {worker && delayReady ? (
        <OffscreenShirtCanvas
          setDecalReady={setDecalReady}
          setShirtReady={setShirtReady}
          setCanvasReady={setCanvasReady}
          setPreviousDecalReady={setPreviousDecalReady}
          wobbleRange={wobbleRange}
          wobbleSpeed={wobbleSpeed}
          disabled={disabled}
          motif={motif}
          color={color}
          motifScale={motifScale}
          motifBaseline={motifBaseline}
          worker={worker}
        />
      ) : null}
    </div>
  )
}
