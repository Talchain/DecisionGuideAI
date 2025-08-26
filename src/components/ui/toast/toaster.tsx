"use client"

import * as React from "react"
import { Toast } from "./toast"
import { useToast } from "./use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <Toast.Provider>
      {toasts.map(({ id, title, description, type }) => (
        <Toast key={id} variant={type}>
          <div className="grid gap-1">
            {title && <Toast.Title>{title}</Toast.Title>}
            {description && (
              <Toast.Description>{description}</Toast.Description>
            )}
          </div>
          <Toast.Close />
        </Toast>
      ))}
      <Toast.Viewport />
    </Toast.Provider>
  )
}
