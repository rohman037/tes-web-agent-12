const fs = require('fs');

let code = fs.readFileSync('src/db/dbService.ts', 'utf8');
code = code.replace("export const dbGetSystemMemory = async () =>", "export const dbGetSystemMemory = async (): Promise<any> =>");
code = code.replace("export const dbGetQrisConfig = async () =>", "export const dbGetQrisConfig = async (): Promise<any> =>");
code = code.replace("export const dbGetContactSettings = async () =>", "export const dbGetContactSettings = async (): Promise<any> =>");
code = code.replace("export const dbGetLoginUiSettings = async () =>", "export const dbGetLoginUiSettings = async (): Promise<any> =>");
code = code.replace("export const dbGetUserUiSettings = async () =>", "export const dbGetUserUiSettings = async (): Promise<any> =>");
code = code.replace("export const dbGetGrowthState = async () =>", "export const dbGetGrowthState = async (): Promise<any> =>");
code = code.replace("export const dbGetActiveGenerations = async () =>", "export const dbGetActiveGenerations = async (): Promise<any> =>");

fs.writeFileSync('src/db/dbService.ts', code);
