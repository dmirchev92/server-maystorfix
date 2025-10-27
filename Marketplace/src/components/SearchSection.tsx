'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { setFilters } from '@/store/slices/searchSlice'

export function SearchSection() {
  const [searchData, setSearchData] = useState({
    serviceType: '',
    city: '',
    neighborhood: ''
  })
  const dispatch = useDispatch()
  const router = useRouter()

  const serviceTypes = [
    { value: 'electrician', label: 'Електротехник' },
    { value: 'plumber', label: 'Водопроводчик' },
    { value: 'hvac', label: 'Климатик' },
    { value: 'carpenter', label: 'Дърводелец' },
    { value: 'painter', label: 'Бояджия' },
    { value: 'locksmith', label: 'Ключар' },
    { value: 'cleaner', label: 'Почистване' },
    { value: 'gardener', label: 'Градинар' },
    { value: 'handyman', label: 'Майстор за всичко' },
    { value: 'appliance_repair', label: 'Ремонт на уреди' },
  ]

  const cities = [
    { value: 'София', label: 'София' },
    { value: 'Пловдив', label: 'Пловдив' },
    { value: 'Варна', label: 'Варна' },
    { value: 'Бургас', label: 'Бургас' },
  ]

  const sofiaNeighborhoods = [
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Update Redux store with search filters
    dispatch(setFilters(searchData))
    
    // Navigate to search results
    const params = new URLSearchParams()
    if (searchData.serviceType) params.append('category', searchData.serviceType)
    if (searchData.city) params.append('city', searchData.city)
    if (searchData.neighborhood) params.append('neighborhood', searchData.neighborhood)
    
    router.push(`/search?${params.toString()}`)
  }

  return (
    <section className="py-16 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Намерете майстор за вашия проект
          </h2>
          <p className="text-lg text-slate-300">
            Изберете услугата, която търсите и намерете най-добрите професионалисти в района
          </p>
        </div>

        <form onSubmit={handleSearch} className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Тип услуга
              </label>
              <select
                value={searchData.serviceType}
                onChange={(e) => setSearchData({ ...searchData, serviceType: e.target.value })}
                className="input-field"
              >
                <option value="">Всички услуги</option>
                {serviceTypes.map((service) => (
                  <option key={service.value} value={service.value}>
                    {service.label}
                  </option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Град <span className="text-red-400">*</span>
              </label>
              <select
                value={searchData.city}
                onChange={(e) => setSearchData({ 
                  ...searchData, 
                  city: e.target.value,
                  neighborhood: '' // Reset neighborhood when city changes
                })}
                className="input-field"
                required
              >
                <option value="">Изберете град</option>
                {cities.map((city) => (
                  <option key={city.value} value={city.value}>
                    {city.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Neighborhood (only for Sofia) */}
            {searchData.city === 'София' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Квартал
                </label>
                <select
                  value={searchData.neighborhood}
                  onChange={(e) => setSearchData({ ...searchData, neighborhood: e.target.value })}
                  className="input-field"
                >
                  <option value="">Всички квартали</option>
                  {sofiaNeighborhoods.map((neighborhood) => (
                    <option key={neighborhood} value={neighborhood}>
                      {neighborhood}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <button
              type="submit"
              className="btn-primary px-8 py-3 text-lg"
            >
              Търсете майстори
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

