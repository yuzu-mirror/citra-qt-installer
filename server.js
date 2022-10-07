import * as xml from "https://deno.land/x/xml@2.0.4/mod.ts";
import { which } from "https://deno.land/x/which@0.2.1/mod.ts";

const tempDir = "./temp";
const distDir = "/citra/nginx/citra_repo";

async function getReleases(repo) {
  const result = await fetch(`https://api.github.com/repos/${repo}/releases`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Citra Installer - Repo (j-selby)",
    },
  });
  return result.json();
}

async function checkExists(directory) {
  try {
    await Deno.stat(directory);
    return true;
  } catch (_) {
    return false;
  }
}

async function check7z() {
  for (const bin of ["7zz", "7za"]) {
    const path = await which(bin);
    if (path) return path;
  }
  throw new Error("7-zip is not available!");
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getTopResultFor(jsonData, platform) {
  for (const releaseKey in jsonData) {
    const release = jsonData[releaseKey];
    for (const assetKey in release.assets) {
      const asset = release.assets[assetKey];
      if (asset.name.indexOf(platform) !== -1 && asset.name.endsWith(".7z")) {
        return {
          release_id: release.tag_name.split("-")[1],
          published_at: release.published_at.substr(0, 10),
          name: asset.name,
          size: asset.size,
          hash: release.tag_name,
        };
      }
    }
  }

  return { notFound: true };
}

const zipBin = await check7z();
// The Qt Installer Framework is a pain to build or download.
// Because all we need are a few 7-zipped + xml files, we might as well generate them for ourselves.
const targets = [
  {
    Name: "org.citra.nightly.%platform%",
    DisplayName: "Citra Nightly",
    Description:
      "The nightly builds of Citra are official, tested versions of Citra that are known to work.\n" +
      "(%platform%, commit: %commithash%, release date: %releasedate%)",
    Repo: "citra-emu/citra-nightly",
    ScriptName: "nightly",
    Default: "script",
    Licenses: [
      {
        License: {
          "@file": "license.txt",
          "@name": "GNU General Public License v2.0",
        },
      },
    ],
  },
  {
    Name: "org.citra.canary.%platform%",
    DisplayName: "Citra Canary",
    Description:
      "An in-development version of Citra that uses changes that are relatively untested.\n" +
      "(%platform%, commit: %commithash%, release date: %releasedate%)",
    Repo: "citra-emu/citra-canary",
    ScriptName: "canary",
    Default: "script",
    Licenses: [
      {
        License: {
          "@file": "license.txt",
          "@name": "GNU General Public License v2.0",
        },
      },
    ],
  },
];

async function execute() {
  // Clean up any temporary directories.
  try {
    await Deno.remove(tempDir, { recursive: true });
  } catch (_) {
    // nothing
  }

  // Get Git information
  console.debug("Getting release info...");
  for (const target of targets) {
    target.Repo = await getReleases(target.Repo);
  }

  console.debug("Building metadata...");

  // If updates available is still false at the end of the foreach loop
  // then that means no releases have been made -- nothing to do.
  let updatesAvailable = false;

  // Updates.xml
  const updates = {
    ApplicationName: "{AnyApplication}",
    ApplicationVersion: "1.0.0", // Separate from nightly / canary versions
    Checksum: false, // As they are pulled straight from Github
    PackageUpdate: [],
  };

  async function generate(targetSource, platform) {
    // Get Git metadata
    const releaseData = getTopResultFor(targetSource.Repo, platform);
    const name = targetSource.Name.replace("%platform%", platform);

    if (releaseData.notFound === true) {
      console.error(`Release information not found for ${name}!`);
      return;
    }

    const scriptName = platform + "-" + targetSource.ScriptName;
    const version = releaseData.release_id;

    const targetMetadataFilePath = `${distDir}/${name}/${version}meta.7z`;
    if (await checkExists(targetMetadataFilePath)) {
      console.debug(
        `Metadata information already exists for ${name} ${version}, skipping.`
      );
    } else {
      console.info(`Building release information for ${name} ${version}.`);
      updatesAvailable = true;

      // Create the temporary working directory.
      const workingDirectoryPath = `${tempDir}/${name}`;
      await Deno.mkdir(workingDirectoryPath, { recursive: true });

      // Copy license
      await Deno.copyFile("license.txt", `${workingDirectoryPath}/license.txt`);
      await Deno.copyFile(
        `scripts/${scriptName}.qs`,
        `${workingDirectoryPath}/installscript.qs`
      );

      // Create 7zip archive
      const fileName = `${name}.meta.7z`;
      const proc = Deno.run({
        cmd: [zipBin, "a", fileName, name],
        cwd: tempDir,
      });
      const status = (await proc.status()).code;
      if (status !== 0) {
        throw new Error(
          `Error when creating ${name} archive. Exited with ${status}.`
        );
      }

      // Copy the metadata file into the target path.
      console.debug(
        `Creating target metadata for ${name} at ${targetMetadataFilePath}`
      );
      await Deno.mkdir(`${distDir}/${name}`, { recursive: true });
      await Deno.rename(`${tempDir}/${fileName}`, `${targetMetadataFilePath}`);

      // Cleanup temporary working directory.
      await Deno.remove(workingDirectoryPath, { recursive: true });
    }

    // Create metadata for the Update.xml
    const metaHash = await crypto.subtle.digest(
      "SHA-1",
      await Deno.readFile(targetMetadataFilePath)
    );

    const target = {
      Name: name,
      DisplayName: targetSource.DisplayName.replace("%platform%", platform),
      Version: version,
      DownloadableArchives: releaseData.name,
      // Because we cannot compute the uncompressed size ourselves, just give a generous estimate
      // (to make sure they have enough disk space).
      // OS flag is useless - i.e the installer stubs it :P
      UpdateFile: {
        "@UncompressedSize": releaseData.size * 2,
        "@CompressedSize": releaseData.size,
        "@OS": "Any",
      },
      ReleaseDate: releaseData.published_at,
      Description: targetSource.Description.replace("%platform%", platform)
        .replace("%commithash%", releaseData.hash)
        .replace("%releasedate%", releaseData.published_at),
      Default: targetSource.Default,
      Licenses: targetSource.Licenses,
      Script: "installscript.qs",
      SHA: bufferToHex(metaHash),
    };

    updates.PackageUpdate.push(target);
  }

  // 6/19/18 (Flame Sage) - MSVC builds have been disabled, removed it from the below array 'msvc'
  await Promise.all(
    ["mingw", "osx", "linux"].map((platform) => {
      return Promise.all(
        targets.map((targetSource) => generate(targetSource, platform))
      );
    })
  );

  if (updatesAvailable) {
    const updatesXml = xml.stringify({ Updates: updates }, { indentSize: 2 });

    // Save Updates.xml
    await Deno.writeTextFile(`${distDir}/Updates.xml`, updatesXml);
    console.info("Wrote a new Updates.xml file -- updates available.");
  } else {
    console.info(
      "No Citra binary release updates are available for the Updates.xml -- nothing to do."
    );
  }
}

execute().catch((err) => {
  console.error(err);
});
