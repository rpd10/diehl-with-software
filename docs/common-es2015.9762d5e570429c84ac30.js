(window.webpackJsonp=window.webpackJsonp||[]).push([[1],{osTo:function(t,e,a){"use strict";a.d(e,"a",(function(){return r}));var s=a("YtkY"),o=a("EM62"),c=a("4wDu");let r=(()=>{class t{constructor(t){this.scullyRoutes=t,this.articles$=this.scullyRoutes.available$.pipe(Object(s.a)(t=>t.filter(t=>t.route.startsWith("/blog/")).sort((t,e)=>new Date(t.date).getTime()<new Date(e.date).getTime()?1:-1))),this.tags$=this.scullyRoutes.available$.pipe(Object(s.a)(t=>t.reduce((t,e)=>((e.tags||[]).forEach(e=>t.add(e)),t),new Set)),Object(s.a)(t=>[...t].sort()))}}return t.\u0275fac=function(e){return new(e||t)(o.Ub(c.c))},t.\u0275prov=o.Hb({token:t,factory:t.\u0275fac,providedIn:"root"}),t})()}}]);