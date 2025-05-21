import * as fs from 'fs';
import * as path from 'path';

// Directories to search for files
const directories = [
  'src/controllers',
  'src/middleware',
  'src/routes',
  'src/services',
  'src/webhooks'
];

// File extensions to process
const extensions = ['.ts', '.js'];

// Search for string indicating direct Prisma import
const searchStrings = [
  'import { PrismaClient } from \'@prisma/client\';',
  'import {PrismaClient} from \'@prisma/client\';',
  'import { PrismaClient } from "@prisma/client";',
  'import {PrismaClient} from "@prisma/client";'
];

// Search for PrismaClient instantiation
const prismaInstanceString = 'const prisma = new PrismaClient();';

// Replacement strings
const importReplacement = 'import { prisma } from \'../utils/prisma\';';
const importRelativeDepth2 = 'import { prisma } from \'../../utils/prisma\';';
const importRelativeDepth3 = 'import { prisma } from \'../../../utils/prisma\';';

// Process a file
function processFile(filePath: string): void {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check for Prisma import
    for (const searchString of searchStrings) {
      if (content.includes(searchString)) {
        // Determine the correct replacement based on file depth
        const relativePath = path.relative('src', filePath);
        const depth = relativePath.split(path.sep).length - 1;
        
        let replacement;
        if (depth === 1) {
          replacement = importReplacement;
        } else if (depth === 2) {
          replacement = importRelativeDepth2;
        } else {
          replacement = importRelativeDepth3;
        }
        
        content = content.replace(searchString, replacement);
        modified = true;
      }
    }
    
    // Check for Prisma instantiation
    if (content.includes(prismaInstanceString)) {
      content = content.replace(prismaInstanceString, '// Using singleton Prisma client from utils/prisma');
      modified = true;
    }
    
    // Save the file if modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Process all directories
function processDirectories(): void {
  directories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`Directory not found: ${fullPath}`);
      return;
    }
    
    processDirectory(fullPath);
  });
}

// Process a directory recursively
function processDirectory(dirPath: string): void {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (stat.isFile() && extensions.includes(path.extname(file))) {
      processFile(filePath);
    }
  });
}

// Main function
function main(): void {
  console.log('Updating Prisma client imports...');
  processDirectories();
  console.log('Done!');
}

main(); 