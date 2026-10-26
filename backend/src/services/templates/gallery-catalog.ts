export type GalleryTemplate = { id:string; name:string; category:string; description:string; styles:string[]; features:string[]; industry:string; popularity:number; createdAt:string; isFavorite?:boolean; source:'catalog'|'saved'; image:string; headline:string; accent:string; templateData:{elements:any[];pageSettings:any} };
const definitions = [
 {id:'greeny',name:'Greeny',category:'Business',industry:'Business',styles:['Modern','Fun'],features:['Blog'],image:'flowers',headline:'Research done right\nmade effortlessly',accent:'#89dcce'},
 {id:'homa',name:'Homa',category:'eCommerce',industry:'Technology',styles:['Bold','Modern'],features:['Online Store','Membership'],image:'earth',headline:'enter an\nexciting new world',accent:'#fb714b'},
 {id:'creatix',name:'Creatix',category:'Agency',industry:'Creative',styles:['Professional','Minimal'],features:['Blog','Multilingual'],image:'space',headline:'Create Stunning\nWebsites',accent:'#8ecbfa'},
 {id:'alex',name:'Alex',category:'Portfolio',industry:'Creative',styles:['Bold','Creative'],features:['Blog'],image:'space',headline:'Shaping the future\none idea at a time',accent:'#ff7b35'},
 {id:'flavoro',name:'Flavoro',category:'Restaurant',industry:'Hospitality',styles:['Minimal','Professional'],features:['Booking'],image:'earth',headline:'Redefining Humanity’s\nPlace in Space',accent:'#e7b789'},
 {id:'travely',name:'Travely',category:'Travel',industry:'Travel',styles:['Modern','Fun'],features:['Booking','Multilingual'],image:'mountains',headline:'Join The Club Before\nEveryone Else Does It.',accent:'#c4f7ac'},
 {id:'educa',name:'Educa',category:'Education',industry:'Education',styles:['Creative','Professional'],features:['Membership','Blog'],image:'sunrise',headline:'Set in, scale calmly.\nAutonomous agents for your brand.',accent:'#f9dca0'},
 {id:'fitlab',name:'FitLab',category:'Health & Wellness',industry:'Health & Wellness',styles:['Modern','Minimal'],features:['Booking','Membership'],image:'landscape',headline:'Financial clarity for\nstudios that dream big.',accent:'#91ebe1'},
];
export const GALLERY_TEMPLATES:GalleryTemplate[]=definitions.map((item,index)=>{
 const image=`/templates/${item.image}.jpg`;
 const node=(suffix:string,type:string,content:string,styles:Record<string,string>,children?:any[])=>({id:`${item.id}-${suffix}`,type,content,styles,...(children?{children}:{})});
 const elements=[node('hero','container','',{backgroundColor:'#080e18',backgroundImage:`linear-gradient(180deg,rgba(3,10,21,.24),rgba(3,10,21,.45)),url(${image})`,backgroundSize:'cover',backgroundPosition:'center',color:'#ffffff',padding:'40px',minHeight:'680px',display:'flex',flexDirection:'column',gap:'24px'},[
  node('nav','container','',{display:'flex',flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:'100px'},[node('logo','heading',item.name,{fontSize:'24px',fontWeight:'700'}),node('links','text','Discover    About    Our work    Contact',{fontSize:'13px'})]),
  node('eyebrow','text',`${item.category.toUpperCase()} / A NEW PERSPECTIVE`,{fontSize:'12px',letterSpacing:'3px',color:item.accent}),
  node('title','heading',item.headline.replace('\n',' '),{fontSize:'56px',fontWeight:'700',lineHeight:'1.1',maxWidth:'720px'}),
  node('intro','text','Bring your next idea to life. Thoughtful design, fresh perspectives, and a space to make your own.',{fontSize:'17px',lineHeight:'1.7',maxWidth:'530px'}),
  {...node('cta','button','Explore more',{backgroundColor:item.accent,color:'#08111e',padding:'14px 24px',borderRadius:'24px',width:'fit-content'}),link:'#discover'},
 ]),node('discover','container','',{padding:'70px 40px',backgroundColor:'#f7f8fb',color:'#0b1220',display:'flex',flexDirection:'column',gap:'20px'},[
  node('section-title','heading','A fresh perspective. Built around you.',{fontSize:'36px',fontWeight:'700'}),node('section-copy','text','Make this space your own. Customize the words, imagery, and details to tell your story.',{fontSize:'17px',lineHeight:'1.8'}),
  node('features','container','',{display:'flex',flexDirection:'row',flexWrap:'wrap',gap:'28px'},['Thoughtfully designed','Ready for your ideas','Made to grow'].map((title,i)=>node(`feature-${i}`,'container','',{padding:'28px',backgroundColor:'#ffffff',borderRadius:'14px',flex:'1',minWidth:'220px'},[node(`feature-title-${i}`,'heading',title,{fontSize:'22px',fontWeight:'600'}),node(`feature-copy-${i}`,'text','Create something memorable with a flexible starting point.',{fontSize:'15px',lineHeight:'1.7'})]))),
 ]),node('footer','container','',{padding:'32px 40px',backgroundColor:'#080e18',color:'#bbc5d5'},[node('footer-text','text',`${item.name} — Start something beautiful.`,{fontSize:'14px'})])];
 return {...item,description:`${item.name} is an editable ${item.category.toLowerCase()} starting point with a full hero, introduction, feature section, and footer.`,popularity:100-index,createdAt:'2026-10-01T00:00:00.000Z',source:'catalog',image,templateData:{elements,pageSettings:{pageTitle:item.name,metaDescription:`${item.name} website`,backgroundColor:'#080e18'}}};
});
