'use client'

import React, { useState, useEffect } from 'react'
import { sofiaNeighborhoods } from './NeighborhoodSelect'

interface UnifiedCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  mode: 'template' | 'direct'
  templateData?: any
  isSubmitting?: boolean
  providerName: string
  providerId?: string
  providerCategory?: string
  customerPhone?: string
}

export default function UnifiedCaseModal({
  isOpen,
  onClose,
  onSubmit,
  mode,
  templateData,
  isSubmitting = false,
  providerName,
  providerId,
  providerCategory,
  customerPhone
}: UnifiedCaseModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)

  // Map provider service categories to service type values
  const getServiceTypeFromCategory = (category: string | undefined): string => {
    if (!category) return 'general'
    
    const categoryMap: { [key: string]: string } = {
      'electrician': 'electrician',
      'plumber': 'plumber', 
      'hvac': 'hvac',
      'carpenter': 'carpenter',
      'painter': 'painter',
      'locksmith': 'locksmith',
      'cleaner': 'cleaner',
      'gardener': 'gardener',
      'handyman': 'handyman',
      'appliance_repair': 'handyman', // Map appliance repair to handyman
      'general': 'general'
    }
    
    return categoryMap[category.toLowerCase()] || 'general'
  }

  // Initialize form data based on mode
  useEffect(() => {
    if (mode === 'direct') {
      // Get today's date in YYYY-MM-DD format for the date input
      const today = new Date().toISOString().split('T')[0];
      
      setFormData({
        serviceType: getServiceTypeFromCategory(providerCategory),
        description: '',
        preferredDate: today, // Pre-fill with today's date
        preferredTime: 'morning',
        priority: 'normal',
        city: '',
        neighborhood: '',
        phone: customerPhone || '',
        additionalDetails: '',
        assignmentType: providerId ? 'specific' : 'open'
      })
    } else if (mode === 'template' && templateData?.fields) {
      const initialData: Record<string, any> = {}
      templateData.fields.forEach((field: any) => {
        initialData[field.id] = field.defaultValue || ''
      })
      setFormData(initialData)
    }
  }, [mode, templateData, providerCategory, providerId, customerPhone])

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }))
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return

    const newFiles = Array.from(files).filter(file => {
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Моля, качете само изображения')
        return false
      }
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Файлът е твърде голям. Максимален размер: 5MB')
        return false
      }
      return true
    })

    setScreenshots(prev => {
      const combined = [...prev, ...newFiles]
      if (combined.length > 5) {
        alert('Максимум 5 снимки')
        return prev
      }
      return combined
    })
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (mode === 'direct') {
      // Validate required fields for direct mode
      if (!formData.description || !formData.preferredDate || !formData.phone || !formData.city) {
        alert('Моля, попълнете всички задължителни полета')
        return
      }
      // Neighborhood required only when city is Sofia
      if (formData.city === 'София' && !formData.neighborhood) {
        alert('Моля, изберете квартал за град София')
        return
      }
      
      onSubmit({
        ...formData,
        screenshots: screenshots
      })
    } else {
      // Template mode - submit template data
      onSubmit(formData)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-xl flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {mode === 'template' ? 'Попълни формата' : 'Създай заявка за услуга'}
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'template' && templateData?.fields ? (
            // Template Mode - Dynamic form based on template
            <>
              <div className="mb-4">
                <h4 className="text-lg font-medium text-white mb-2">
                  {templateData.title || 'Информация за услугата'}
                </h4>
                {templateData.description && (
                  <p className="text-slate-300 text-sm mb-4">{templateData.description}</p>
                )}
              </div>

              {templateData.fields.map((field: any) => (
                <div key={field.id} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  
                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                    />
                  )}
                  
                  {field.type === 'textarea' && (
                    <textarea
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={3}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                    />
                  )}
                  
                  {field.type === 'select' && (
                    <select
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      required={field.required}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                    >
                      <option value="">Изберете...</option>
                      {field.options?.map((option: any) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  {field.type === 'number' && (
                    <input
                      type="number"
                      value={formData[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      min={field.min}
                      max={field.max}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                    />
                  )}
                  
                  {field.description && (
                    <p className="text-xs text-gray-500">{field.description}</p>
                  )}
                </div>
              ))}
            </>
          ) : (
            // Direct Mode - Standard case creation form
            <>
              <div className="mb-4">
                <h4 className="text-lg font-medium text-white mb-2">
                  Заявка за {providerName}
                </h4>
                <p className="text-slate-300 text-sm">
                  Попълнете информацията за услугата, която търсите
                </p>
              </div>

              {/* Assignment Type */}
              {providerId && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Тип заявка
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center text-white cursor-pointer">
                      <input
                        type="radio"
                        name="assignmentType"
                        value="specific"
                        checked={formData.assignmentType === 'specific'}
                        onChange={(e) => handleInputChange('assignmentType', e.target.value)}
                        className="mr-2"
                      />
                      <span>Директно към {providerName}</span>
                    </label>
                    <label className="flex items-center text-white cursor-pointer">
                      <input
                        type="radio"
                        name="assignmentType"
                        value="open"
                        checked={formData.assignmentType === 'open'}
                        onChange={(e) => handleInputChange('assignmentType', e.target.value)}
                        className="mr-2"
                      />
                      <span>Отворена заявка за всички специалисти</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Тип услуга <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.serviceType || ''}
                  onChange={(e) => handleInputChange('serviceType', e.target.value)}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="electrician">Електротехник</option>
                  <option value="plumber">Водопроводчик</option>
                  <option value="hvac">Климатик</option>
                  <option value="carpenter">Дърводелец</option>
                  <option value="painter">Бояджия</option>
                  <option value="locksmith">Ключар</option>
                  <option value="cleaner">Почистване</option>
                  <option value="gardener">Градинар</option>
                  <option value="handyman">Майстор за всичко</option>
                  <option value="general">Друго</option>
                </select>
              </div>

              {/* Location: City */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Град <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.city || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    // Update city and reset neighborhood when city changes
                    handleInputChange('city', val)
                    handleInputChange('neighborhood', '')
                  }}
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Изберете град</option>
                  <option value="София">София</option>
                  <option value="Пловдив">Пловдив</option>
                  <option value="Варна">Варна</option>
                  <option value="Бургас">Бургас</option>
                </select>
              </div>

              {/* Neighborhood (only for Sofia) */}
              {formData.city === 'София' && (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Квартал <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.neighborhood || ''}
                    onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                    required={formData.city === 'София'}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Изберете квартал</option>
                    {sofiaNeighborhoods.map((neighborhood) => (
                      <option key={neighborhood} value={neighborhood}>
                        {neighborhood}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Описание на проблема <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Опишете подробно какво трябва да се направи..."
                  required
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                />
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Предпочитана дата <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.preferredDate || ''}
                    onChange={(e) => handleInputChange('preferredDate', e.target.value)}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Предпочитано време
                  </label>
                  <select
                    value={formData.preferredTime || 'morning'}
                    onChange={(e) => handleInputChange('preferredTime', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="morning">Сутрин (8:00-12:00)</option>
                    <option value="afternoon">Следобед (12:00-17:00)</option>
                    <option value="evening">Вечер (17:00-20:00)</option>
                    <option value="flexible">Гъвкаво време</option>
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Приоритет
                </label>
                <select
                  value={formData.priority || 'normal'}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Нисък</option>
                  <option value="normal">Нормален</option>
                  <option value="urgent">Спешен</option>
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Телефон за контакт <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Въведете телефонен номер"
                  required
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                />
              </div>

              {/* Screenshots Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Снимки (опционално)
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className="hidden"
                    id="screenshot-upload"
                  />
                  <label htmlFor="screenshot-upload" className="cursor-pointer">
                    <div className="text-slate-300">
                      <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p>Кликнете или плъзнете снимки тук</p>
                      <p className="text-xs text-slate-400">Максимум 5 снимки, до 5MB всяка</p>
                    </div>
                  </label>
                </div>

                {/* Screenshot Preview */}
                {screenshots.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {screenshots.map((file, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Screenshot ${index + 1}`}
                          className="w-full h-20 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeScreenshot(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Additional Details */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Допълнителни детайли
                </label>
                <textarea
                  value={formData.additionalDetails || ''}
                  onChange={(e) => handleInputChange('additionalDetails', e.target.value)}
                  placeholder="Допълнителна информация, специални изисквания..."
                  rows={2}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                />
              </div>

            </>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 border border-slate-600 text-slate-200 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Отказ
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Изпращане...</span>
                </>
              ) : (
                <span>{mode === 'template' ? 'Изпрати формата' : 'Създай заявка'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}