'use strict';

const assert = require('assert');
const path = require('path');

const justFiles = qualifyNames(['/justFiles/a.json', '/justFiles/b.json', '/justFiles/dummy.txt']);
const nestedFiles = qualifyNames(['/nested/c.json', 'nested/d.json', '/nested/mydir/e.json']);
const textFiles = qualifyNames(['/justFiles/dummy.txt']);
const matchFiles = qualifyNames(['/mixed/aabbcc.json', '/mixed/ab.json']);

const files = require('../lib/files');
const FileHound = require('../lib/filehound');

function getAbsolutePath(file) {
  return path.join(__dirname + '/fixtures/', file);
}

function qualifyNames(names) {
  return names.map(getAbsolutePath);
}

describe('FileHound', () => {
  const fixtureDir = __dirname + '/fixtures';

  describe('depth', () => {
    it('only returns files in the current directory', () => {
      const query = FileHound.create()
        .paths(fixtureDir + '/deeplyNested')
        .depth(0)
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/deeplyNested/c.json', 'deeplyNested/d.json']));
        });
    });

    it('only returns files one level deep', () => {
      const query = FileHound.create()
        .paths(fixtureDir + '/deeplyNested')
        .depth(1)
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files,
            qualifyNames([
              '/deeplyNested/c.json', 'deeplyNested/d.json', 'deeplyNested/mydir/e.json']));
        });
    });

    it('returns files n level deep', () => {
      const query = FileHound.create()
        .paths(fixtureDir + '/deeplyNested')
        .depth(3)
        .find();

      return query
        .then((files) => {
          files.sort();
          assert.deepEqual(files,
            qualifyNames([
              'deeplyNested/c.json',
              'deeplyNested/d.json',
              'deeplyNested/mydir/e.json',
              'deeplyNested/mydir/mydir2/f.json',
              'deeplyNested/mydir/mydir2/mydir3/z.json',
              'deeplyNested/mydir/mydir2/y.json'
            ]));
        });
    });
  });

  describe('.paths', () => {
    it('returns all files in a given directory', () => {
      const query = FileHound.create()
        .paths(fixtureDir + '/justFiles')
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files, justFiles);
        });
    });

    it('returns files performing a recursive search', () => {
      const query = FileHound.create()
        .paths(fixtureDir + '/nested')
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files, nestedFiles);
        });
    });

    it('returns matching files from multiple search paths', () => {
      const location1 = fixtureDir + '/nested';
      const location2 = fixtureDir + '/justFiles';

      const query = FileHound.create()
        .paths(location1, location2)
        .find();

      return query.then((files) => {
        const expected = nestedFiles.concat(justFiles).sort();
        assert.deepEqual(files, expected);
      });
    });

    it('removes duplicate paths', () => {
      const location1 = fixtureDir + '/nested';

      const fh = FileHound.create();
      fh.paths(location1, location1);

      assert.deepEqual(fh.getSearchPaths(), [location1]);
    });

    it('returns a defensive copy of the search directories', () => {
      const fh = FileHound.create();
      fh.paths('a', 'b', 'c');
      const directories = fh.getSearchPaths();
      directories.push('d');

      assert.equal(fh.getSearchPaths().length, 3);
    });

    it('normalises paths', () => {
      const location1 = fixtureDir + '/nested';
      const location2 = fixtureDir + '/nested/mydir';
      const location3 = fixtureDir + '/justFiles/moreFiles';
      const location4 = fixtureDir + '/justFiles';

      const fh = FileHound.create();
      fh.paths(location2, location1, location4, location3);

      assert.deepEqual(fh.getSearchPaths(), [location4, location1]);
    });
  });

  describe('.discard', () => {
    it('ignores matching sub-directories', () => {
      const query = FileHound.create()
        .paths(fixtureDir + '/nested')
        .discard('mydir')
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/nested/c.json', '/nested/d.json']));
        });
    });

    it('ignores files', () => {
      const query = FileHound.create()
        .paths(fixtureDir + '/nested')
        .discard('c\.json')
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/nested/d.json', '/nested/mydir/e.json']));
        });
    });

    it('ignores everything using a greedy match', () => {
      const query = FileHound.create()
        .paths(fixtureDir + '/nested')
        .discard('.*')
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files, []);
        });
    });

    it('matches all files after being negated', () => {
      const query = FileHound.create()
        .paths(fixtureDir + '/nested')
        .discard('.*')
        .not()
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files, nestedFiles);
        });
    });
  });

  describe('callbacks', () => {
    it('supports callbacks', (done) => {
      FileHound.create()
        .paths(fixtureDir + '/justFiles')
        .find((err, files) => {
          assert.ifError(err);
          assert.deepEqual(files, justFiles);
          done();
        });
    });
  });

  describe('.ext', () => {
    it('returns files for a given ext', () => {
      const query = FileHound.create()
        .ext('txt')
        .paths(fixtureDir + '/justFiles')
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files, textFiles);
        });
    });
  });

  describe('.match', () => {
    it('returns files for given match name', () => {
      const query = FileHound.create()
        .match('*ab*.json')
        .paths(fixtureDir + '/mixed')
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files.sort(), matchFiles);
        });
    });

    it('returns files using glob method', () => {
      const query = FileHound.create()
        .glob('*ab*.json')
        .paths(fixtureDir + '/mixed')
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files.sort(), matchFiles);
        });
    });

    it('performs recursive search using matching on a given pattern', () => {
      const query = FileHound.create()
        .match('*.json')
        .paths(fixtureDir + '/nested')
        .find();

      return query
        .then((files) => {
          assert.deepEqual(files.sort(), nestedFiles);
        });
    });
  });

  describe('.not', () => {
    it('returns files not matching the given query', () => {
      const notJsonStartingWithZ = FileHound.create()
        .match('*.json')
        .paths(fixtureDir + '/justFiles')
        .not()
        .find();

      return notJsonStartingWithZ
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/justFiles/dummy.txt']));
        });
    });
  });

  describe('.any', () => {
    it('returns matching files for any query', () => {
      const jsonStartingWithZ = FileHound.create()
        .match('*.json')
        .paths(fixtureDir + '/justFiles')
        .find();

      const onlyTextFles = FileHound.create()
        .ext('txt')
        .paths(fixtureDir + '/justFiles')
        .find();

      const results = FileHound.any(jsonStartingWithZ, onlyTextFles);

      return results
        .then((files) => {
          assert.deepEqual(files, justFiles);
        });
    });
  });

  describe('.size', () => {
    it('returns files matched using the equality operator by default', () => {
      const sizeFile10Bytes = FileHound.create()
        .size(20)
        .paths(fixtureDir + '/justFiles')
        .find();

      return sizeFile10Bytes
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/justFiles/b.json']));
        });
    });

    it('returns files that equal a given number of bytes', () => {
      const sizeFile10Bytes = FileHound.create()
        .size('==20')
        .paths(fixtureDir + '/justFiles')
        .find();

      return sizeFile10Bytes
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/justFiles/b.json']));
        });
    });

    it('returns files greater than a given size', () => {
      const sizeGreaterThan1k = FileHound.create()
        .size('>1024')
        .paths(fixtureDir + '/sizes')
        .find();

      return sizeGreaterThan1k
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/sizes/2k.txt']));
        });
    });

    it('returns files less than a given size', () => {
      const sizeLessThan1k = FileHound.create()
        .size('<1024')
        .paths(fixtureDir + '/sizes')
        .find();

      return sizeLessThan1k
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/sizes/10b.txt', '/sizes/1b.txt']));
        });
    });

    it('returns files less than or equal to a given size', () => {
      const lessThanOrEqualTo1k = FileHound.create()
        .size('<=1024')
        .paths(fixtureDir + '/sizes')
        .find();

      return lessThanOrEqualTo1k
        .then((files) => {
          assert.deepEqual(files, qualifyNames(
            ['/sizes/10b.txt', '/sizes/1b.txt', '/sizes/1k.txt']));
        });
    });

    it('returns files greater than or equal to a given size', () => {
      const greaterThanOrEqualTo1k = FileHound.create()
        .size('>=1024')
        .paths(fixtureDir + '/sizes')
        .find();

      return greaterThanOrEqualTo1k
        .then((files) => {
          assert.deepEqual(files, qualifyNames(
            ['/sizes/1k.txt', '/sizes/2k.txt']));
        });
    });

    it('returns files within a given size range', () => {
      const range = FileHound.create()
        .size('>0')
        .size('<=1024')
        .paths(fixtureDir + '/sizes')
        .find();

      return range
        .then((files) => {
          assert.deepEqual(files, qualifyNames(
            ['/sizes/10b.txt', '/sizes/1b.txt', '/sizes/1k.txt']));
        });
    });

    // it('returns files within for a specific size in megabytes');
    // it('returns files within for a specific size in gigabytes');
  });

  describe('.isEmpty()', () => {
    it('returns zero length files', () => {
      const allEmpty = FileHound.create()
        .isEmpty(20)
        .paths(fixtureDir + '/justFiles')
        .find();

      return allEmpty
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/justFiles/a.json', '/justFiles/dummy.txt']));
        });
    });
  });

  describe('.ignoreHiddenFiles()', () => {
    it('strips hidden files', () => {
      const noHiddenFiles = FileHound.create()
        .ignoreHiddenFiles()
        .paths(fixtureDir + '/visibility')
        .find();

      noHiddenFiles.then((files) => {
        assert.equal(files.length, 2);
        assert.deepEqual(files, qualifyNames(['/visibility/.hidden/visible.json', '/visibility/visible.json']));
      });
    });

    it('strips files within hidden directories when included', () => {
      const noHiddenFiles = FileHound.create()
        .ignoreHiddenFiles(true)
        .paths(fixtureDir + '/visibility')
        .find();

      noHiddenFiles.then((files) => {
        assert.equal(files.length, 1);
        assert.deepEqual(files, qualifyNames(['/visibility/visible.json']));
      });
    });
  });

  describe('.addFilter', () => {
    it('returns files based on a custom filter', () => {
      const customFilter = FileHound.create()
        .addFilter((file) => {
          const stats = files.getStats(file);
          return stats.size === 1024;
        })
        .paths(fixtureDir + '/custom')
        .find();

      return customFilter
        .then((files) => {
          assert.deepEqual(files, qualifyNames(['/custom/passed.txt']));
        });
    });
  });
});
