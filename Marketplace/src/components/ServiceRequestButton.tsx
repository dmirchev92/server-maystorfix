interface ServiceRequestButtonProps {
  onClick: () => void
  providerName: string
}

export default function ServiceRequestButton({ onClick, providerName }: ServiceRequestButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-green-600 hover:to-blue-600 transition-all duration-200 flex items-center justify-center space-x-2"
    >
      <span>🔧</span>
      <span>Създай заявка за {providerName}</span>
    </button>
  )
}