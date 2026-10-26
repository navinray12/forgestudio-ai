import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { createPersonalWebsite } from '../websites/create-personal-website.js';
import { documentObject, validateDocumentTree } from '../websites/document-policy.js';
import { GALLERY_TEMPLATES, type GalleryTemplate } from './gallery-catalog.js';

function savedTemplate(row:any):GalleryTemplate {
 const data=typeof row.templateData==='string'?JSON.parse(row.templateData):row.templateData;
 const strings=(value:unknown,fallback:string[])=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):fallback;
 return {id:row.id,name:row.name,category:row.category||'Other',description:row.description||'Your saved template',styles:strings(data?.gallery?.styles,['Professional']),features:strings(data?.gallery?.features,[]),industry:typeof data?.gallery?.industry==='string'?data.gallery.industry:'Other',popularity:0,createdAt:new Date(row.createdAt).toISOString(),isFavorite:row.isFavorite,source:'saved',image:typeof data?.pageSettings?.socialImage==='string'?data.pageSettings.socialImage:'',headline:row.name,accent:'#a855f7',templateData:{elements:Array.isArray(data?.elements)?data.elements:[],pageSettings:data?.pageSettings||{}}};
}
export async function listGallery(userId:string){
 const rows:any[]=await prisma.$queryRaw`SELECT id,name,description,type,category,"isFavorite","templateData","createdAt" FROM templates WHERE "userId"=${userId}::uuid ORDER BY "createdAt" DESC`;
 const favorites=new Set(rows.filter(row=>row.type==='CATALOG_FAVORITE'&&row.isFavorite).map(row=>(typeof row.templateData==='string'?JSON.parse(row.templateData):row.templateData)?.catalogId));
 return [...GALLERY_TEMPLATES.map(item=>({...item,isFavorite:favorites.has(item.id)})),...rows.filter(row=>row.type!=='CATALOG_FAVORITE').map(savedTemplate)];
}
export async function galleryFavorite(userId:string,id:string,isFavorite:boolean){
 if(typeof isFavorite!=='boolean')throw new AppError('Favorite must be true or false.',400,'VALIDATION_ERROR');
 const catalog=GALLERY_TEMPLATES.find(item=>item.id===id);
 if(catalog){
  await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gallery:${userId}:${id}`}))`;
   const rows:any[]=await tx.$queryRaw`SELECT id FROM templates WHERE "userId"=${userId}::uuid AND type='CATALOG_FAVORITE' AND "templateData"->>'catalogId'=${id} LIMIT 1`;
   if(rows.length)await tx.$executeRaw`UPDATE templates SET "isFavorite"=${isFavorite},"updatedAt"=now() WHERE id=${rows[0].id}::uuid AND "userId"=${userId}::uuid`;
   else if(isFavorite)await tx.$executeRaw`INSERT INTO templates (id,"userId",name,type,category,"isFavorite","templateData","createdAt","updatedAt") VALUES (${randomUUID()}::uuid,${userId}::uuid,${catalog.name},'CATALOG_FAVORITE',${catalog.category},true,${JSON.stringify({catalogId:id,elements:[],pageSettings:{}})}::jsonb,now(),now())`;
  });
 }else{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new AppError('Template not found.',404,'TEMPLATE_NOT_FOUND');
  const count=await prisma.$executeRaw`UPDATE templates SET "isFavorite"=${isFavorite},"updatedAt"=now() WHERE id=${id}::uuid AND "userId"=${userId}::uuid AND type<>'CATALOG_FAVORITE'`;
  if(!count)throw new AppError('Template not found.',404,'TEMPLATE_NOT_FOUND');
 }
 return {id,isFavorite};
}
export function cloneTemplateDocument(template:GalleryTemplate){
 const data=documentObject(template.templateData);
 if(!Array.isArray(data.elements)||!data.elements.length)throw new AppError('This template has no editable content.',422,'INVALID_TEMPLATE');
 validateDocumentTree({elements:data.elements});
 const clone=(nodes:any[]):any[]=>nodes.map(node=>({...node,id:randomUUID(),...(Array.isArray(node.children)?{children:clone(node.children)}:{})}));
 const elements=clone(data.elements);
 const doc=documentObject({version:1,elements,homePageId:'home',activePageId:'home',pages:[{id:'home',name:'Home',slug:'/',isHome:true,elements,pageSettings:template.templateData.pageSettings||{}}]});
 validateDocumentTree(doc);return doc;
}
export async function useGalleryTemplate(userId:string,id:string,name:string){
 const template=(await listGallery(userId)).find(item=>item.id===id);
 if(!template)throw new AppError('Template not found.',404,'TEMPLATE_NOT_FOUND');
 const document=cloneTemplateDocument(template);
 return createPersonalWebsite({userId,name,editorData:document as any});
}
