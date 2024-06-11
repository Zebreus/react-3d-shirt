import {
  DestroyMessage,
  InitMessage,
  InteractionMessage,
  MoveMessage,
  UpdatePropsMessage,
  UpdateTextureMessage,
  WindowInfoMessage,
} from "OffscreenShirt"
import { setScreenSize } from "rendering/render"
import { addSubcanvas, removeSubcanvas, updateSubcanvas, updateSubcanvasProps } from "rendering/subcanvas"
import { processUpdateTexture } from "rendering/textures"

// eslint-disable-next-line import/no-namespace
import * as THREE from "three"
import { Event } from "three"

function noop() {}

export class ElementProxyReceiver extends THREE.EventDispatcher {
  left = 0
  top = 0
  width = 0
  height = 0
  style = {}
  ownerDocument
  body
  constructor() {
    super()
    this.ownerDocument = this
    this.body = this
  }
  get clientWidth() {
    return this.width
  }
  get clientHeight() {
    return this.height
  }
  getBoundingClientRect() {
    return {
      left: this.left,
      top: this.top,
      width: this.width,
      height: this.height,
      right: this.left + this.width,
      bottom: this.top + this.height,
    }
  }
  handleEvent(data: Record<string, unknown> & Event) {
    console.log("handleEvent", data)
    if (data["type"] === "size") {
      this.left = data["left"] as number
      this.top = data["top"] as number
      this.width = data["width"] as number
      this.height = data["height"] as number
      return
    }
    data["preventDefault"] = noop
    data["stopPropagation"] = noop
    this.dispatchEvent(data)
  }
  focus() {}
  releasePointerCapture() {}
  setPointerCapture() {}
}

class ProxyManager {
  targets: Record<string, ElementProxyReceiver>
  constructor() {
    this.targets = {}
    this.handleEvent = this.handleEvent.bind(this)
  }
  makeProxy(data: { id: string }) {
    const { id } = data
    const proxy = new ElementProxyReceiver()
    this.targets[id] = proxy
  }
  getProxy(id: string) {
    return this.targets[id]
  }
  handleEvent(data: { id: string; data: Record<string, unknown> }) {
    this.targets[data.id]?.handleEvent(data.data as Record<string, unknown> & Event)
  }
}

const proxyManager = new ProxyManager()

// export const OffscreenShirtContent = ({
//   decalUrl,
//   color = "#202020",
//   wobbleRange,
//   wobbleSpeed,
//   disabled,
//   decalScale,
//   decalBaseline,
// }: {
//   /** An url to an image that is printed onto the shirt */
//   decalUrl?: string
//   /** The shirt color */
//   color?: string
//   /** How much the camera wobbles */
//   wobbleRange?: number
//   /** How fast the camera wobbles */
//   wobbleSpeed?: number
//   /** Disable interaction */
//   disabled?: boolean
//   /** Scale the decal size by this factor */
//   decalScale?: number
//   /** Set the vertical baseline of the decal (shift it up or down) */
//   decalBaseline?: number
// }) => {
//   const { material, aspectRatio, ready: materialReady } = useShirtMaterial(decalUrl)

//   const ready = materialReady

//   return (
//     <ShirtContent
//       ready={ready}
//       wobbleRange={wobbleRange}
//       wobbleSpeed={wobbleSpeed}
//       color={color}
//       disabled={disabled}
//       decalMaterial={material}
//       decalAspect={aspectRatio}
//       decalScale={decalScale}
//       decalBaseline={decalBaseline}
//     />
//   )
// }

export const processEvent = (
  event:
    | InitMessage
    | UpdatePropsMessage
    | InteractionMessage
    | UpdateTextureMessage
    | DestroyMessage
    | WindowInfoMessage
    | MoveMessage
) => {
  if (event.type === "init") {
    processInit(event)
  }

  if (event.type === "destroy") {
    processDestroy(event)
  }

  if (event.type === "interaction") {
    processInteraction(event)
  }

  if (event.type === "updateProps") {
    processUpdate(event)
  }

  if (event.type === "updateTexture") {
    processUpdateTexture(event)
  }

  if (event.type === "windowInfo") {
    setScreenSize(event)
  }

  if (event.type === "move") {
    processMove(event)
  }
}

const processInteraction = ({ event, canvasId }: InteractionMessage) => {
  console.log("processInteraction", event)
  proxyManager.handleEvent({ id: canvasId, data: event })
}

// export const getProxyElement = () => {
//   const canvasId = useCanvasId()
//   const proxy = proxyManager.getProxy(canvasId)
//   if (!proxy) {
//     throw new Error("Proxy should exist, because we created it in init")
//   }
//   return proxy
// }

/**
// export const useCanvasId = () => {
//   const three = useThree()
//   // @ts-expect-error: We abuse the webgl context to store the canvas id
//   return three.gl["canvasId"] as string
// }

// export const useProxyElement = () => {
//   const canvasId = useCanvasId()
//   const proxy = proxyManager.getProxy(canvasId)
//   if (!proxy) {
//     throw new Error("Proxy should exist, because we created it in init")
//   }
//   return proxy
// }

// let globalSetProps: ((props: InitMessage["props"]) => void) | undefined = undefined
// let globalInitialProps: InitMessage["props"] = {} as InitMessage["props"]

// const setInitialProps = (canvasId: string, props: InitMessage["props"]) => {
//   setGlobalValue("shirtProps", canvasId, props)
// }

// const App = ({ canvasId }: { canvasId: string }) => {
//   const [props] = useGlobalValue<InitMessage["props"]>(
//     "shirtProps",
//     canvasId,
//     "invalid" as unknown as InitMessage["props"]
//   )
//   if ((props as unknown as string) === "invalid") {
//     throw new Error("Props should be set before rendering")
//   }

//   const three = useThree()
//   // @ts-expect-error: We abuse the webgl context to store the canvas id
//   if (three?.gl?.["canvasId"] !== canvasId) {
//     // @ts-expect-error: We abuse the webgl context to store the canvas id
//     three.gl["canvasId"] = canvasId
//   }

//   return (
//     <OffscreenShirtContent
//       color={props.color}
//       disabled={props.disabled}
//       decalUrl={props.motif}
//       decalBaseline={props.decalBaseline}
//       decalScale={props.decalScale}
//       wobbleRange={props.wobbleRange}
//       wobbleSpeed={props.wobbleSpeed}
//     />
//   )
// }

// const roots: Record<string, ReconcilerRoot<HTMLCanvasElement>> = {}
 */

const processDestroy = ({ canvasId }: DestroyMessage) => {
  removeSubcanvas(canvasId)
}

const processInit = ({ canvas, width, height, props, canvasId, x, y }: InitMessage) => {
  console.log("processInit", canvasId)
  proxyManager.makeProxy({ id: canvasId })
  const proxy = proxyManager.getProxy(canvasId)
  if (!proxy) {
    throw new Error("Proxy should exist, because we just created it")
  }
  // @ts-expect-error: newly defined
  self.document = {}

  proxy.width = width
  proxy.height = height

  addSubcanvas({
    id: canvasId,
    canvas: canvas,
    width: width,
    height: height,
    x: x,
    y: y,
    props: props,
    proxy: proxy as unknown as HTMLElement,
  })

  // root.configure({
  //   size: {
  //     width,
  //     height,
  //     top: 0,
  //     left: 0,
  //     updateStyle: false,
  //   },
  //   dpr: pixelRatio, // important
  //   onCreated: state => {
  //     state.events.connect?.(proxy)
  //     const message: CanvasReadyMessage = {
  //       type: "setCanvasReady",
  //       value: true,
  //       canvasId: canvasId,
  //     }
  //     postMessage(message)
  //   },
  //   events: undefined,
  // })
}

const processUpdate = ({ props, canvasId }: UpdatePropsMessage) => {
  // setInitialProps(canvasId, props)
  updateSubcanvasProps(canvasId, props)
}

const processMove = ({ width, height, x, y, canvasId }: MoveMessage) => {
  console.log("processMove", canvasId, width, height, x, y)
  updateSubcanvas(canvasId, { width, height, x, y })
}
