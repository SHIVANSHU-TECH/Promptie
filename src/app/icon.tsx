import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#00513d",
          color: "#ffffff",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        P
      </div>
    ),
    { ...size },
  )
}
