import { Decal, PerspectiveCamera, RenderTexture, useCursor, useGLTF, useTexture } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { Suspense, useRef, useState } from "react"
import { shirturi } from "shirtdata"
import { BufferGeometry, DoubleSide, Material, Mesh, Object3D } from "three"

const UrlMaterial = ({ url }: { url: string | undefined }) => {
  if (!url) {
    throw new Promise(() => {})
  }
  const motif = useTexture(url, texture => {
    const textures = Array.isArray(texture) ? texture : [texture]
    textures.forEach(t => {
      t.flipY = false
    })
  })

  return (
    <meshPhongMaterial map={motif} depthTest depthWrite={false} transparent polygonOffset polygonOffsetFactor={-4} />
  )
}

const RotatingShape = () => {
  const meshRef = useRef<{ rotation: { x: number; y: number } }>()
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = meshRef.current.rotation.y += delta
    }
  })
  return (
    <mesh
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={meshRef as any}
      scale={2}
    >
      <icosahedronGeometry args={[1]} />
      <meshStandardMaterial color="goldenrod" />
    </mesh>
  )
}

const LoaderMaterial = () => {
  return (
    <meshStandardMaterial roughness={0.6} transparent polygonOffset polygonOffsetFactor={-10}>
      <RenderTexture attach="map" anisotropy={16}>
        <PerspectiveCamera makeDefault manual aspect={1 / 1} position={[0, 0, 5]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} />
        <RotatingShape />
      </RenderTexture>
    </meshStandardMaterial>
  )
}

const ShirtMaterial = ({ url }: { url: string | undefined }) => {
  return (
    <Suspense fallback={<LoaderMaterial />}>
      <UrlMaterial url={url} />
    </Suspense>
  )
}

type BasicShirtProps = {
  color: string
  url: string | undefined
  objectRef?: React.MutableRefObject<Object3D<Event>[] | undefined>
  disabled?: boolean
}

export const BasicShirt = ({ url, color, objectRef, disabled }: BasicShirtProps) => {
  const { nodes } = useGLTF(shirturi)

  const [hover, setHover] = useState(false)
  useCursor(hover && !disabled)

  return (
    <mesh
      ref={(ref: Object3D<Event> & Mesh<BufferGeometry, Material | Material[]>) => {
        if (objectRef) {
          objectRef.current = [ref]
        }
      }}
      castShadow
      receiveShadow
      scale={1}
      /** @ts-expect-error: TODO: Look into why ts thinks there is no geometry property*/
      geometry={nodes["shirt"]?.geometry}
      rotation={[0.5 * Math.PI + 0.1, 0, 0]}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <meshStandardMaterial color={color} roughness={1} side={DoubleSide} />
      <Decal position={[0, 1, 0]} rotation={0} scale={2}>
        <ShirtMaterial url={url} />
      </Decal>
    </mesh>
  )
}
