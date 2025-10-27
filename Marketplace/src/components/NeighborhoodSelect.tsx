'use client'

import { useState } from 'react'

export const sofiaNeighborhoods = [
  '7-и – 11-и километър',
  'Абдовица',
  'Аерогарата',
  'Американски колеж (вилна зона)',
  'БАН IV километър',
  'Банишора',
  'Барите',
  'Батареята',
  'Белите брези (квартал)',
  'Бенковски (квартал)',
  'Борово (квартал)',
  'Ботунец',
  'Ботунец 1',
  'Ботунец 2',
  'Бояна (квартал на София)',
  'Бункера',
  'Бъкстон',
  'Васил Левски (квартал на София)',
  'Витоша (квартал)',
  'Воденицата',
  'Военна рампа',
  'Враждебна',
  'Връбница-1',
  'Връбница-2',
  'Гевгелийски квартал',
  'Гео Милев (квартал)',
  'Горна баня',
  'Горна баня (вилна зона)',
  'Горубляне',
  'Гоце Делчев (квартал)',
  'Градина (квартал)',
  'Група-Зоопарк',
  'Гърдова глава',
  'Дианабад',
  'Дианабад (промишлена зона)',
  'Димитър Миленков (квартал)',
  'Долни Смърдан',
  'Драгалевци',
  'Дружба (квартал на София)',
  'Друмо',
  'Дървеница',
  'Експериментален',
  'Западен парк (квартал)',
  'Захарна фабрика',
  'Зона Б-18',
  'Зона Б-19',
  'Зона Б-5',
  'Зона Б-5-3',
  'Иван Вазов',
  'Изгрев',
  'Изток',
  'Илинден',
  'Илиянци',
  'Искър',
  'Канала',
  'Карпузица',
  'Килиите',
  'Киноцентъра',
  'Княжево',
  'Красна поляна 1',
  'Красна поляна 2',
  'Красна поляна 3',
  'Красно село',
  'Кремиковци',
  'Крива река',
  'Кръстова вада',
  'Лагера',
  'Лев Толстой (жилищен комплекс)',
  'Левски В',
  'Левски Г',
  'Лозенец (квартал на София)',
  'Люлин (вилна зона)',
  'Люлин (квартал)',
  'Мала кория',
  'Малинова долина',
  'Малинова долина (жилищен комплекс)',
  'Манастирски ливади',
  'Манастирски ливади (жилищен комплекс)',
  'Манастирски ливади - Б',
  'Младост 1',
  'Младост 1А',
  'Младост 2',
  'Младост 3',
  'Младост 4',
  'Могилата (вилна зона)',
  'Модерно предградие',
  'Модерно предградие (промишлена зона)',
  'Надежда I',
  'Надежда II',
  'Надежда III',
  'Надежда IV',
  'Национален киноцентър',
  'Нова махала – Враждебна',
  'Нови силози',
  'Обеля',
  'Обеля 1',
  'Обеля 2',
  'Овча купел',
  'Овча купел (жилищен комплекс)',
  'Орландовци',
  'Парк „Бакърени гробища"',
  'Подлозище',
  'Подуяне',
  'Полигона (квартал)',
  'Равнище (квартал)',
  'Разсадник-Коньовица',
  'Резиденция Бояна (квартал)',
  'Република (квартал)',
  'Република-2',
  'Света Троица (квартал)',
  'Свобода (квартал)',
  'Секулица (квартал)',
  'Сердика (жилищен комплекс)',
  'Сеславци',
  'Симеоново',
  'Славия (квартал)',
  'Слатина (промишлена зона)',
  'Смърдана',
  'Средец (промишлена зона)',
  'Стрелбище (квартал)',
  'Студентски град',
  'Сухата река',
  'Суходол (квартал)',
  'Толева махала',
  'Требич',
  'Триъгълника-Надежда',
  'Трънска махала',
  'Факултета',
  'Филиповци (жилищен комплекс)',
  'Филиповци (квартал)',
  'Фондови жилища',
  'Фохар',
  'Хаджи Димитър (жилищен комплекс)',
  'Хаджи Димитър (промишлена зона)',
  'Хиподрума',
  'Хладилника',
  'Хладилника (промишлена зона)',
  'Христо Ботев (квартал на София)',
  'Христо Смирненски (жилищен комплекс)',
  'Център на София',
  'Челопечене',
  'Чепинско шосе',
  'Черния кос',
  'Черно конче',
  'Южен парк (квартал)',
  'Яворов (жилищен комплекс)',
  'Япаджа'
]

interface NeighborhoodSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  disabled?: boolean
}

export default function NeighborhoodSelect({
  value,
  onChange,
  placeholder = "Изберете квартал",
  required = false,
  className = "",
  disabled = false
}: NeighborhoodSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredNeighborhoods = sofiaNeighborhoods.filter(neighborhood =>
    neighborhood.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (neighborhood: string) => {
    onChange(neighborhood)
    setIsOpen(false)
    setSearchTerm('')
  }

  const defaultClasses = "mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"

  return (
    <div className="relative">
      {/* Simple select for basic usage */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className={className || defaultClasses}
      >
        <option value="">{placeholder}</option>
        {sofiaNeighborhoods.map((neighborhood) => (
          <option key={neighborhood} value={neighborhood}>
            {neighborhood}
          </option>
        ))}
      </select>
    </div>
  )
}

// Searchable version for advanced usage
export function SearchableNeighborhoodSelect({
  value,
  onChange,
  placeholder = "Търсете или изберете квартал",
  required = false,
  className = "",
  disabled = false
}: NeighborhoodSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredNeighborhoods = sofiaNeighborhoods.filter(neighborhood =>
    neighborhood.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelect = (neighborhood: string) => {
    onChange(neighborhood)
    setIsOpen(false)
    setSearchTerm('')
  }

  const defaultClasses = "mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : value}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={className || defaultClasses}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute inset-y-0 right-0 flex items-center pr-2"
          disabled={disabled}
        >
          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {filteredNeighborhoods.length === 0 ? (
            <div className="px-4 py-2 text-gray-500">Няма намерени квартали</div>
          ) : (
            filteredNeighborhoods.map((neighborhood) => (
              <button
                key={neighborhood}
                type="button"
                onClick={() => handleSelect(neighborhood)}
                className="w-full text-left px-4 py-2 hover:bg-indigo-600 hover:text-white focus:bg-indigo-600 focus:text-white"
              >
                {neighborhood}
              </button>
            ))
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
