'use strict';
const {fs,crypto}=require('./common.cjs');
const ENTERPRISE={onedrive_business:'onedrive',sharepoint:'onedrive',gshared:'drive'};
function metadata(config,provider){if(!ENTERPRISE[provider]||!fs.existsSync(config))return null;let c;try{c=require('./resumable-upload.cjs').section(config,provider)}catch{return null}const id=provider==='gshared'?c.team_drive:c.drive_id;if(!id)return null;return{type:c.drive_type||'shared',id,fingerprint:crypto.createHash('sha256').update(JSON.stringify([provider,id,c.root_folder_id||''])).digest('hex')};}
function requireEnterprise(config,provider){const m=metadata(config,provider);if(!m)throw Error(provider==='gshared'?'请选择 Google 共享云盘':'请选择企业云盘或文档库');if(provider==='onedrive_business'&&m.type!=='business')throw Error('请选择 OneDrive 企业云盘，不能使用个人云盘');if(provider==='sharepoint'&&m.type!=='documentLibrary')throw Error('请选择 SharePoint 文档库');return m}
function authChoice(provider,option){if(option==='config_is_local')return 'true';if(provider==='gshared'&&option==='config_change_team_drive')return 'true';if(provider==='onedrive_business'&&option==='config_type')return 'onedrive';return null}
function choices(provider,option,items){return provider==='sharepoint'&&option==='config_type'?items.filter(x=>x.value!=='onedrive'):items}
module.exports={ENTERPRISE,metadata,requireEnterprise,authChoice,choices};
