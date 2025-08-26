import { toast } from "@/components/ui/toast/use-toast"

export function useCustomToast() {
  const showToast = (title: string, description?: string) => {
    toast({
      title,
      description,
    })
  }

  const showError = (title: string, description?: string) => {
    toast({
      title,
      description,
      type: "destructive"
    })
  }

  const showSuccess = (title: string, description?: string) => {
    toast({
      title,
      description,
      type: "default"
    })
  }

  return {
    toast: showToast,
    error: showError,
    success: showSuccess,
  }
}
