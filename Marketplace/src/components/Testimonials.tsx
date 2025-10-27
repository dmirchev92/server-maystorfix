const testimonials = [
  {
    name: 'Мария Петрова',
    location: 'София, Център',
    service: 'Електротехник',
    rating: 5,
    text: 'Отличен професионалист! Свързах се с него през платформата и за 2 часа беше вкъщи. Работата беше изпълнена перфектно.',
    avatar: '👩'
  },
  {
    name: 'Иван Димитров',
    location: 'Пловдив',
    service: 'Водопроводчик',
    rating: 5,
    text: 'Много доволен от услугата. Майсторът беше пунктуален, професионален и цената беше справедлива.',
    avatar: '👨'
  },
  {
    name: 'Елена Георгиева',
    location: 'Варна',
    service: 'Климатик',
    rating: 5,
    text: 'Препоръчвам платформата! Лесно намерих майстор за монтаж на климатик. Всичко мина безпроблемно.',
    avatar: '👩'
  }
]

export function Testimonials() {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Industrial Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-20 right-20 w-72 h-72 bg-indigo-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-500/10 rounded-lg blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Какво казват клиентите
            </span>
          </h2>
          <p className="text-lg text-slate-300">
            Над 10,000 доволни клиенти в цяла България
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-xl">
              <div className="flex items-center mb-4">
                <div className="text-3xl mr-3">{testimonial.avatar}</div>
                <div>
                  <h4 className="font-semibold text-white">{testimonial.name}</h4>
                  <p className="text-sm text-slate-300">{testimonial.location}</p>
                </div>
              </div>
              
              <div className="flex items-center mb-3">
                <div className="flex text-yellow-400">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                  ))}
                </div>
                <span className="ml-2 text-sm text-slate-300">{testimonial.service}</span>
              </div>
              
              <p className="text-slate-200 italic">
                "{testimonial.text}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

