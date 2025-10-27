"use strict";exports.id=872,exports.ids=[872],exports.modules={872:(e,r,t)=>{t.d(r,{Header:()=>b});var s=t(326),o=t(4001),a=t(7577),i=t(434),l=t(5047),n=t(1223),d=t(7978),c=t(6792),h=t(9837);let x=({user:e,unreadCount:r=0,onLogout:t})=>{let[o,x]=(0,a.useState)(!1),[b,m]=(0,a.useState)(!1);(0,l.useRouter)();let u=[{href:"/",label:"Начало",icon:"\uD83C\uDFE0"},{href:"/search",label:"Търсене",icon:"\uD83D\uDD0D"},{href:"/create-case",label:"Нова заявка",icon:"➕"},...e?.role==="tradesperson"||e?.role==="service_provider"?[{href:"/dashboard",label:"Табло",icon:"\uD83D\uDCCA"}]:[]],p=[...e?.role==="tradesperson"||e?.role==="service_provider"?[{href:"/dashboard",label:"Моето табло",icon:"\uD83D\uDCCA"},{href:"/referrals",label:"Препоръки",icon:"\uD83C\uDFAF"}]:[],{href:"/notifications",label:"Известия",icon:"\uD83D\uDD14",badge:r},...e?.role==="tradesperson"||e?.role==="service_provider"?[{href:"/settings/sms",label:"SMS Настройки",icon:"\uD83D\uDCF1"}]:[],{href:"/settings",label:"Настройки",icon:"⚙️"}];return(0,s.jsxs)("nav",{className:"bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900/90 text-slate-100 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 shadow-lg",children:[(0,s.jsxs)("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",children:[(0,s.jsxs)("div",{className:"flex justify-between items-center h-16",children:[(0,s.jsxs)(i.default,{href:"/",className:"flex items-center space-x-2 group",children:[s.jsx("div",{className:"w-8 h-8 bg-white/10 border border-white/20 rounded-lg flex items-center justify-center transform group-hover:scale-110 transition-transform duration-200",children:s.jsx("span",{className:"text-white font-bold text-sm",children:"\uD83D\uDD27"})}),s.jsx("span",{className:"text-xl font-bold text-white",children:"ServiceText Pro"})]}),s.jsx("div",{className:"hidden md:flex items-center space-x-1",children:u.map(e=>(0,s.jsxs)(i.default,{href:e.href,className:"flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-all duration-200 group",children:[s.jsx("span",{className:"group-hover:scale-110 transition-transform duration-200",children:e.icon}),s.jsx("span",{className:"font-medium",children:e.label})]},e.href))}),(0,s.jsxs)("div",{className:"flex items-center space-x-4",children:[e?(0,s.jsxs)("div",{className:"relative",children:[(0,s.jsxs)("button",{onClick:()=>m(!b),className:"flex items-center space-x-3 p-2 rounded-lg hover:bg-white/10 transition-all duration-200 group",children:[(0,s.jsxs)("div",{className:"relative",children:[s.jsx(d.q,{name:`${e.firstName} ${e.lastName}`,src:e.avatar,size:"sm",status:"online",showStatus:!0}),r>0&&s.jsx("div",{className:"absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse"})]}),(0,s.jsxs)("div",{className:"hidden sm:block text-left",children:[(0,s.jsxs)("p",{className:"text-sm font-medium text-white",children:[e.firstName," ",e.lastName]}),s.jsx("div",{className:"flex items-center space-x-2",children:s.jsx("span",{className:(0,n.cn)("text-xs px-2 py-0.5 rounded-full font-medium","tradesperson"===e.role||"service_provider"===e.role?"bg-indigo-500/20 text-indigo-300 border border-indigo-400/30":"bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"),children:"tradesperson"===e.role||"service_provider"===e.role?"Изпълнител":"Клиент"})})]}),s.jsx("svg",{className:(0,n.cn)("w-4 h-4 text-slate-300 transition-transform duration-200",b&&"rotate-180"),fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M19 9l-7 7-7-7"})})]}),b&&(0,s.jsxs)("div",{className:"absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/10 py-2 z-50",children:[(0,s.jsxs)("div",{className:"px-4 py-3 border-b border-white/10",children:[(0,s.jsxs)("p",{className:"text-sm font-medium text-white",children:[e.firstName," ",e.lastName]}),s.jsx("p",{className:"text-xs text-slate-300",children:e.email})]}),p.map(e=>(0,s.jsxs)(i.default,{href:e.href,className:"flex items-center justify-between px-4 py-2 text-sm text-slate-200 hover:bg-white/10 hover:text-white transition-colors duration-200",onClick:()=>m(!1),children:[(0,s.jsxs)("div",{className:"flex items-center space-x-3",children:[s.jsx("span",{children:e.icon}),s.jsx("span",{children:e.label})]}),e.badge&&e.badge>0&&s.jsx(c.Ct,{variant:"error",size:"sm",children:e.badge})]},e.href)),s.jsx("div",{className:"border-t border-white/10 mt-2 pt-2",children:(0,s.jsxs)("button",{onClick:()=>{m(!1),t?.()},className:"flex items-center space-x-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-200",children:[s.jsx("span",{children:"\uD83D\uDEAA"}),s.jsx("span",{children:"Изход"})]})})]})]}):(0,s.jsxs)("div",{className:"flex items-center space-x-3",children:[s.jsx(i.default,{href:"/auth/login",children:s.jsx(h.z,{variant:"ghost",size:"sm",onClick:()=>{console.log("\uD83D\uDD18 Вход button clicked")},children:"Вход"})}),s.jsx(i.default,{href:"/auth/register",children:s.jsx(h.z,{variant:"primary",size:"sm",onClick:()=>{console.log("\uD83D\uDD18 Регистрация button clicked")},children:"Регистрация"})})]}),s.jsx("button",{onClick:()=>x(!o),className:"md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors duration-200",children:s.jsx("svg",{className:"w-6 h-6",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:o?s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M6 18L18 6M6 6l12 12"}):s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M4 6h16M4 12h16M4 18h16"})})})]})]}),o&&s.jsx("div",{className:"md:hidden border-t border-white/10 py-4",children:s.jsx("div",{className:"space-y-2",children:u.map(e=>(0,s.jsxs)(i.default,{href:e.href,className:"flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors duration-200",onClick:()=>x(!1),children:[s.jsx("span",{children:e.icon}),s.jsx("span",{className:"font-medium",children:e.label})]},e.href))})})]}),(o||b)&&s.jsx("div",{className:"fixed inset-0 z-40",onClick:()=>{x(!1),m(!1)}})]})};function b(){let{user:e,isAuthenticated:r,logout:t}=(0,o.a)(),i=(0,l.useRouter)(),[n,d]=(0,a.useState)(0);return s.jsx(x,{user:e?{id:e.id,firstName:e.firstName,lastName:e.lastName,email:e.email,role:e.role,avatar:e.profileImageUrl||void 0}:void 0,unreadCount:n,onLogout:()=>{t(),i.push("/")}})}t(8069)},7978:(e,r,t)=>{t.d(r,{q:()=>i});var s=t(326);t(7577);var o=t(1223);let a={xs:"h-6 w-6 text-xs",sm:"h-8 w-8 text-sm",md:"h-10 w-10 text-base",lg:"h-12 w-12 text-lg",xl:"h-16 w-16 text-xl","2xl":"h-20 w-20 text-2xl"},i=({src:e,alt:r,name:t="",size:i="md",variant:l="circular",status:n,showStatus:d=!1,className:c,onClick:h})=>{let x=`
    relative inline-flex items-center justify-center
    font-medium text-white
    transition-all duration-300 ease-in-out
    ${h?"cursor-pointer hover:scale-105 hover:shadow-lg":""}
  `,b=t.split(" ").map(e=>e.charAt(0)).join("").toUpperCase().slice(0,2),m=(e=>{let r=["from-purple-400 to-purple-600","from-blue-400 to-blue-600","from-green-400 to-green-600","from-yellow-400 to-yellow-600","from-red-400 to-red-600","from-indigo-400 to-indigo-600","from-pink-400 to-pink-600","from-teal-400 to-teal-600"];return r[Math.abs(e.split("").reduce((e,r)=>r.charCodeAt(0)+((e<<5)-e),0))%r.length]})(t);return(0,s.jsxs)("div",{className:"relative inline-block",children:[(0,s.jsxs)("div",{className:(0,o.cn)(x,a[i],{circular:"rounded-full",rounded:"rounded-lg",square:"rounded-md"}[l],e?"overflow-hidden":`bg-gradient-to-br ${m}`,"ring-2 ring-white shadow-lg",c),onClick:h,children:[e?s.jsx("img",{src:e,alt:r||t,className:"h-full w-full object-cover",onError:e=>{e.target.style.display="none"}}):s.jsx("span",{className:"font-semibold select-none",children:b||"?"}),!e&&s.jsx("div",{className:"absolute inset-0 bg-gradient-to-br from-black/10 to-black/20 rounded-inherit"})]}),d&&n&&s.jsx("div",{className:(0,o.cn)("absolute bottom-0 right-0 rounded-full border-2 border-white",{xs:"h-1.5 w-1.5",sm:"h-2 w-2",md:"h-2.5 w-2.5",lg:"h-3 w-3",xl:"h-3.5 w-3.5","2xl":"h-4 w-4"}[i],{online:"bg-green-400 border-green-500",offline:"bg-gray-400 border-gray-500",away:"bg-yellow-400 border-yellow-500",busy:"bg-red-400 border-red-500"}[n])})]})}},6792:(e,r,t)=>{t.d(r,{Ct:()=>l,OE:()=>n});var s=t(326),o=t(7577),a=t.n(o),i=t(1223);let l=a().forwardRef(({className:e,variant:r="default",size:t="md",icon:o,children:a,...l},n)=>{let d=`
      inline-flex items-center gap-1 font-medium rounded-full
      transition-all duration-200 ease-in-out
      border
    `,c={default:`
        bg-white/10 text-slate-200 border-white/20 backdrop-blur-sm
        hover:bg-white/20
      `,primary:`
        bg-indigo-500/20 text-indigo-300 border-indigo-400/30 backdrop-blur-sm
        hover:bg-indigo-500/30
      `,success:`
        bg-green-500/20 text-green-300 border-green-400/30 backdrop-blur-sm
        hover:bg-green-500/30
      `,warning:`
        bg-yellow-500/20 text-yellow-300 border-yellow-400/30 backdrop-blur-sm
        hover:bg-yellow-500/30
      `,error:`
        bg-red-500/20 text-red-300 border-red-400/30 backdrop-blur-sm
        hover:bg-red-500/30
      `,info:`
        bg-blue-500/20 text-white border-blue-400/30 backdrop-blur-sm
        hover:bg-blue-500/30
      `,outline:`
        bg-transparent text-slate-300 border-white/30 backdrop-blur-sm
        hover:bg-white/5
      `,construction:`
        bg-indigo-600/80 text-white border-transparent backdrop-blur-sm
        hover:bg-indigo-600
        shadow-sm hover:shadow-md
      `,professional:`
        bg-white/20 text-white border-white/30 backdrop-blur-sm
        hover:bg-white/30
        shadow-sm hover:shadow-md
      `};return(0,s.jsxs)("div",{className:(0,i.cn)(d,c[r],{sm:"px-2 py-0.5 text-xs",md:"px-2.5 py-1 text-sm",lg:"px-3 py-1.5 text-base"}[t],e),ref:n,...l,children:[o&&s.jsx("span",{className:"flex-shrink-0",children:o}),s.jsx("span",{children:a})]})});l.displayName="Badge";let n=({status:e,size:r="md",className:t})=>{let o={open:{variant:"success",icon:"\uD83D\uDFE2",label:"Отворена"},wip:{variant:"warning",icon:"⚡",label:"В процес"},closed:{variant:"default",icon:"✅",label:"Затворена"},pending:{variant:"info",icon:"⏳",label:"Чакаща"},accepted:{variant:"success",icon:"✅",label:"Приета"},declined:{variant:"error",icon:"❌",label:"Отказана"},completed:{variant:"default",icon:"\uD83C\uDFC1",label:"Завършена"}}[e]||{variant:"default",icon:"❓",label:e||"Неизвестен"};return s.jsx(l,{variant:o.variant,size:r,className:t,icon:s.jsx("span",{children:o.icon}),children:o.label})}},9837:(e,r,t)=>{t.d(r,{z:()=>l});var s=t(326),o=t(7577),a=t.n(o),i=t(1223);let l=a().forwardRef(({className:e,variant:r="primary",size:t="md",isLoading:o=!1,leftIcon:a,rightIcon:l,children:n,disabled:d,...c},h)=>{let x=`
      inline-flex items-center justify-center gap-2 font-medium rounded-lg
      transition-all duration-300 ease-in-out transform
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500
      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
      active:scale-95 hover:scale-105
    `,b={primary:`
        bg-indigo-600/80 text-white
        hover:bg-indigo-600
        shadow-lg hover:shadow-xl
        border border-transparent
      `,secondary:`
        bg-white/10 text-slate-200 border border-white/20
        hover:bg-white/20 hover:border-white/30
        shadow-sm hover:shadow-md backdrop-blur-sm
      `,outline:`
        bg-transparent text-slate-300 border-2 border-white/30
        hover:bg-white/10 hover:text-white hover:border-white/50
        shadow-sm hover:shadow-lg backdrop-blur-sm
      `,ghost:`
        bg-transparent text-slate-200 border border-transparent
        hover:bg-white/10 hover:text-white
      `,construction:`
        bg-indigo-600/80 text-white
        hover:bg-indigo-600
        shadow-lg hover:shadow-xl
        border border-transparent
        font-semibold
      `,professional:`
        bg-white/20 text-white backdrop-blur-sm
        hover:bg-white/30
        shadow-lg hover:shadow-xl
        border border-white/30
      `,industrial:`
        bg-gradient-to-r from-indigo-600/80 via-slate-600/80 to-purple-600/80 text-white
        hover:from-indigo-600 hover:via-slate-600 hover:to-purple-600
        shadow-lg hover:shadow-2xl
        border border-transparent backdrop-blur-sm
        relative overflow-hidden
        before:absolute before:inset-0 before:bg-gradient-to-r 
        before:from-white/10 before:to-transparent before:opacity-0
        hover:before:opacity-100 before:transition-opacity before:duration-300
      `};return s.jsx("button",{className:(0,i.cn)(x,b[r],{sm:"px-3 py-1.5 text-sm h-8",md:"px-4 py-2 text-sm h-10",lg:"px-6 py-3 text-base h-12",xl:"px-8 py-4 text-lg h-14"}[t],o&&"cursor-wait",e),disabled:d||o,ref:h,...c,children:o?(0,s.jsxs)(s.Fragment,{children:[(0,s.jsxs)("svg",{className:"animate-spin h-4 w-4",xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",children:[s.jsx("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),s.jsx("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"})]}),"Зареждане..."]}):(0,s.jsxs)(s.Fragment,{children:[a&&s.jsx("span",{className:"flex-shrink-0",children:a}),s.jsx("span",{children:n}),l&&s.jsx("span",{className:"flex-shrink-0",children:l})]})})});l.displayName="Button"},1223:(e,r,t)=>{t.d(r,{cn:()=>a});var s=t(1135),o=t(1009);function a(...e){return(0,o.m6)((0,s.W)(e))}}};