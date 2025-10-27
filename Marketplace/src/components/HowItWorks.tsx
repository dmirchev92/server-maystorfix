import { Card, CardContent } from '@/components/ui/Card'

const steps = [
  {
    number: '1',
    title: 'Търсете майстор',
    description: 'Изберете услугата и района, в който търсите професионалист',
    icon: '🔍',
    gradient: 'from-blue-600 to-slate-700'
  },
  {
    number: '2',
    title: 'Свържете се',
    description: 'Изпратете запитване или се свържете директно с майстора',
    icon: '💬',
    gradient: 'from-slate-600 to-blue-600'
  },
  {
    number: '3',
    title: 'Получете оферта',
    description: 'Получете детайлна оферта с цена и срокове за изпълнение',
    icon: '📋',
    gradient: 'from-orange-500 to-orange-600'
  },
  {
    number: '4',
    title: 'Започнете работа',
    description: 'Съгласувайте дата и час за изпълнение на услугата',
    icon: '✅',
    gradient: 'from-green-600 to-emerald-600'
  }
]

export function HowItWorks() {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Industrial Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-lg blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-lg blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Как работи ServiceText Pro
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Прост процес за намиране и наемане на професионалисти в България
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <Card 
                variant="elevated" 
                hover 
                padding="lg"
                className="group h-full transform transition-all duration-500 hover:scale-105"
              >
                <CardContent>
                  <div className="text-center">
                    {/* Step number with gradient */}
                    <div className="relative mb-6">
                      <div className={`w-20 h-20 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center mx-auto shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                        <span className="text-3xl filter drop-shadow-sm">
                          {step.icon}
                        </span>
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                        {step.number}
                      </div>
                    </div>
                    
                    {/* Step title */}
                    <h3 className="text-xl font-bold text-white mb-4 group-hover:text-indigo-300 transition-colors duration-300">
                      {step.title}
                    </h3>
                    
                    {/* Step description */}
                    <p className="text-slate-300 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Connection arrow (except for last item) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-20">
                  <div className="w-8 h-0.5 bg-slate-400"></div>
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1">
                    <div className="w-0 h-0 border-l-4 border-l-slate-400 border-t-2 border-t-transparent border-b-2 border-b-transparent"></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center gap-2 px-8 py-4 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors duration-300 shadow-lg">
            <span>🔧</span>
            Започнете сега - намерете вашия майстор!
          </div>
        </div>
      </div>
    </section>
  )
}

