import { InteractionMessage } from "OffscreenShirt"
import { getSubcanvases } from "rendering/subcanvas"
import { EventDispatcher } from "three"

export const handleInteractionMessage = (message: InteractionMessage) => {
  const subcanvases = getSubcanvases()
  const
}

export class EventProxy extends EventDispatcher {
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
