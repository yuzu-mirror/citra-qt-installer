const xml = require('xml');
const fs = require('fs-extra');
const exec = require('execa');
const sha1 = require('sha1-file');
const req = require('request-promise');
const zipBin = require('7zip-bin').path7za;

const logger = require('winston');
logger.exitOnError = false;
logger.add(logger.transports.File, { filename: '/var/log/citra-qt-installer/citra-qt-installer-repository.log' });

const tempDir = './temp';
const distDir = '/citra/nginx/repo';

async function getReleases (repo) {
  const result = await req({
    uri: `https://api.github.com/repos/${repo}/releases`,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Citra Installer - Repo (j-selby)'
    }
  });
  return JSON.parse(result);
}

function getTopResultFor (jsonData, platform) {
  for (let releaseKey in jsonData) {
    const release = jsonData[releaseKey];
    for (let assetKey in release.assets) {
      const asset = release.assets[assetKey];
      if (asset.name.indexOf(platform) !== -1 && asset.name.endsWith('.7z')) {
        return {
          'release_id': release.tag_name.split('-')[1],
          'published_at': release.published_at.substr(0, 10),
          'name': asset.name,
          'size': asset.size,
          'hash': release.tag_name
        };
      }
    }
  }

  return {'notFound': true};
}

// The Qt Installer Framework is a pain to build or download.
// Because all we need are a few 7-zipped + xml files, we might as well generate them for ourselves.
let targets = [
  {
    'Name': 'org.citra.nightly.%platform%',
    'DisplayName': 'Citra Nightly',
    'Description': 'The nightly builds of Citra are official, tested versions of Citra that are known to work.\n' +
                       '(%platform%, commit: %commithash%, release date: %releasedate%)',
    'Repo': 'citra-emu/citra-nightly',
    'ScriptName': 'nightly',
    'Default': 'script',
    'Licenses': [
      {'License': [{_attr: { file: 'license.txt', name: 'GNU General Public License v2.0' }}]}
    ]
  },
  {
    'Name': 'org.citra.canary.%platform%',
    'DisplayName': 'Citra Canary',
    'Description': 'An in-development version of Citra that uses changes that are relatively untested.\n' +
                       '(%platform%, commit: %commithash%, release date: %releasedate%)',
    'Repo': 'citra-emu/citra-canary',
    'ScriptName': 'canary',
    'Default': 'script',
    'Licenses': [
      {'License': [{_attr: { file: 'license.txt', name: 'GNU General Public License v2.0' }}]}
    ]
  }
];

async function execute () {
  // Clean up any temporary directories.
  fs.emptyDirSync(tempDir);

  // Get Git information
  logger.debug('Getting release info...');
  for (var resultKey in targets) {
    const target = targets[resultKey];
    target.Repo = await getReleases(target.Repo);
  }

  logger.debug('Building metadata...');

  // If updates available is still false at the end of the foreach loop
  // then that means no releases have been made -- nothing to do.
  var updatesAvailable = false;

  // Updates.xml
  let updates = [
    {'ApplicationName': '{AnyApplication}'},
    {'ApplicationVersion': '1.0.0'}, // Separate from nightly / canary versions
    {'Checksum': false} // As they are pulled straight from Github
  ];

  ['msvc', 'mingw', 'osx', 'linux'].forEach((platform) => {
    targets.forEach((targetSource) => {
      // Get Git metadata
      const releaseData = getTopResultFor(targetSource.Repo, platform);
      const name = targetSource.Name.replace('%platform%', platform);

      if (releaseData.notFound === true) {
        logger.error(`Release information not found for ${name}!`);
        return;
      }

      const scriptName = platform + '-' + targetSource.ScriptName;
      const version = releaseData.release_id;

      const targetMetadataFilePath = `${distDir}/${name}/${version}meta.7z`;
      if (fs.existsSync(targetMetadataFilePath)) {
        logger.debug(`Metadata information already exists for ${name} ${version}, skipping.`);
      } else {
        logger.info(`Building release information for ${name} ${version}.`);
        updatesAvailable = true;

        // Create the temporary working directory.
        const workingDirectoryPath = `${tempDir}/${name}`;
        fs.ensureDirSync(workingDirectoryPath);

        // Copy license
        fs.copySync('license.txt', `${workingDirectoryPath}/license.txt`);
        fs.copySync(`scripts/${scriptName}.qs`, `${workingDirectoryPath}/installscript.qs`);

        // Create 7zip archive
        exec.sync(zipBin, ['a', 'meta.7z', name], {'cwd': tempDir});

        // Copy the metadata file into the target path.
        logger.debug(`Creating target metadata for ${name} at ${targetMetadataFilePath}`);
        fs.moveSync(`${tempDir}/meta.7z`, targetMetadataFilePath);

        // Cleanup temporary working directory.
        fs.removeSync(workingDirectoryPath);
      }

      // Create metadata for the Update.xml
      var metaHash = sha1(targetMetadataFilePath);

      let target = [];
      target.push({'Name': name});
      target.push({'DisplayName': targetSource.DisplayName.replace('%platform%', platform)});
      target.push({'Version': version});
      target.push({'DownloadableArchives': releaseData.name});

      // Because we cannot compute the uncompressed size ourselves, just give a generous estimate
      // (to make sure they have enough disk space).
      // OS flag is useless - i.e the installer stubs it :P
      target.push({'UpdateFile': [{_attr: {
        UncompressedSize: releaseData.size * 2,
        CompressedSize: releaseData.size,
        OS: 'Any'}
      }]});

      target.push({'ReleaseDate': releaseData.published_at});
      target.push({'Description': targetSource.Description
        .replace('%platform%', platform)
        .replace('%commithash%', releaseData.hash)
        .replace('%releasedate%', releaseData.published_at)});
      target.push({'Default': targetSource.Default});
      target.push({'Licenses': targetSource.Licenses});
      target.push({'Script': 'installscript.qs'});
      target.push({'SHA': metaHash});

      updates.push({'PackageUpdate': target});
    });
  });

  if (updatesAvailable) {
    const updatesXml = xml({'Updates': updates}, {indent: '  '});

    // Save Updates.xml
    fs.writeFileSync(`${distDir}/Updates.xml`, updatesXml);
    logger.info('Wrote a new Updates.xml file -- updates are available.');
  } else {
    logger.info('No Citra binary release updates are available for the Updates.xml -- nothing to do.');
  }
}

execute().catch((err) => {
  logger.error(err);
});
