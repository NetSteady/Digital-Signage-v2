import * as fs from "fs";
import * as path from "path";

const clearAssets = (dir: string) => {
  fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
    if (err) {
      console.error(`Error reading directory ${dir}:`, err);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        fs.rm(fullPath, { recursive: true, force: true }, (err) => {
          if (err) {
            console.error(`Error removing directory ${fullPath}:`, err);
          } else {
            console.log(`Removed directory: ${fullPath}`);
          }
        });
      } else if (entry.isFile()) {
        fs.unlink(fullPath, (err) => {
          if (err) {
            console.error(`Error deleting file ${fullPath}:`, err);
          } else {
            console.log(`Deleted file: ${fullPath}`);
          }
        });
      }
    }
  });
};

export default clearAssets;
