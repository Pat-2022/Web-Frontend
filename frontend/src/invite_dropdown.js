let $ = {
   get: function(selector){ 
      let ele = document.querySelectorAll(selector);
      for(let i = 0; i < ele.length; i++){
         this.init(ele[i]);
      }
      return ele;
   },
   template: function(html){
      let template = document.createElement('div');
      template.innerHTML = html.trim();
      return this.init(template.childNodes[0]);
   },
   init: function(ele){
      ele.on = function(event, func){ this.addEventListener(event, func); }
      return ele;
   }
};

//Build the plugin
let drop = function(info){let o = {
   options: info.options,
   selected: info.selected || [],
   preselected: info.preselected || [],
   open: false,
   html: {
      select: $.get(info.selector)[0],
      options: $.get(info.selector + ' option'),
      parent: undefined,
   },
   init: function(){
      //Setup Drop HTML
      this.html.parent = $.get(info.selector)[0].parentNode
      this.html.drop = $.template('<div class="drop"></div>')
      this.html.dropDisplay = $.template('<div class="drop-display">Display</div>')
      this.html.dropOptions = $.template('<div class="drop-options">Options</div>')
      this.html.dropScreen = $.template('<div class="drop-screen"></div>')
      
      this.html.parent.insertBefore(this.html.drop, this.html.select)
      this.html.drop.appendChild(this.html.dropDisplay)
      this.html.drop.appendChild(this.html.dropOptions)
      this.html.drop.appendChild(this.html.dropScreen)
      //Hide old select
      this.html.drop.appendChild(this.html.select);
      
      //Core Events
      let that = this;
      this.html.dropDisplay.on('click', function(){ that.toggle() });
      this.html.dropScreen.on('click', function(){ that.toggle() });
      //Run Render
      this.load()
      this.preselect()
      this.render();
   },
   toggle: function(){
      this.html.drop.classList.toggle('open');
   },
   addOption: function(e, element){ 
      let index = Number(element.dataset.index);
      this.clearStates()
      this.selected.push({
         index: Number(index),
         state: 'add',
         removed: false
      })
      this.options[index].state = 'remove';
      this.render()
   },
   removeOption: function(e, element){
      e.stopPropagation();
      this.clearStates()
      let index = Number(element.dataset.index);
      this.selected.forEach(function(select){
         if(select.index == index && !select.removed){
            select.removed = true
            select.state = 'remove'
         }
      })
      this.options[index].state = 'add'
      this.render();
   },
   load: function(){
      this.options = [];
      for(let i = 0; i < this.html.options.length; i++){
         let option = this.html.options[i]
         this.options[i] = {
            html:  option.innerHTML,
            value: option.value,
            selected: option.selected,
            state: ''
         }
      }
   },
   preselect: function(){
      let that = this;
      this.selected = [];
      this.preselected.forEach(function(pre){
         that.selected.push({
            index: pre,
            state: 'add',
            removed: false
         })
         that.options[pre].state = 'remove';
      })
   },
   render: function(){
      this.renderDrop()
      this.renderOptions()
   },
   renderDrop: function(){ 
      let that = this;
      let parentHTML = $.template('<div></div>')
      this.selected.forEach(function(select, index){ 
         let option = that.options[select.index];
         let childHTML = $.template('<span class="item '+ select.state +'">'+ option.html +'</span>')
         let childCloseHTML = $.template(
            '<i class="material-icons btnclose" data-index="'+select.index+'">&#xe5c9;</i></span>')
         childCloseHTML.on('click', function(e){ that.removeOption(e, this) })
         childHTML.appendChild(childCloseHTML)
         parentHTML.appendChild(childHTML)
      })
      this.html.dropDisplay.innerHTML = ''; 
      this.html.dropDisplay.appendChild(parentHTML)
   },
   renderOptions: function(){  
      let that = this;
      let parentHTML = $.template('<div></div>')
      this.options.forEach(function(option, index){
         let childHTML = $.template(
            '<a data-index="'+index+'" class="'+option.state+'">'+ option.html +'</a>')
         childHTML.on('click', function(e){ that.addOption(e, this) })
         parentHTML.appendChild(childHTML)
      })
      this.html.dropOptions.innerHTML = '';
      this.html.dropOptions.appendChild(parentHTML)
   },
   clearStates: function(){
      let that = this;
      this.selected.forEach(function(select, index){ 
         select.state = that.changeState(select.state)
      })
      this.options.forEach(function(option){ 
         option.state = that.changeState(option.state)
      })
   },
   changeState: function(state){
      switch(state){
         case 'remove':
            return 'hide'
         case 'hide':
            return 'hide'
         default:
            return ''
       }
   },
   isSelected: function(index){
      let check = false
      this.selected.forEach(function(select){ 
         if(select.index == index && select.removed == false) check = true
      })
      return check
   }
}; o.init(); return o;}


//Set up some data
// let options = [
//    { html: 'cats', value: 'cats' },
//    { html: 'fish', value: 'fish' },
//    { html: 'squids', value: 'squids' },
//    { html: 'cats', value: 'whales' },
//    { html: 'cats', value: 'bikes' },
// ];

let myDrop = new drop({
   selector:  '#myMulti',
});
 myDrop.toggle();