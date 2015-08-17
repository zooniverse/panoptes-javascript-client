var gulp = require("gulp");
var mocha = require("gulp-mocha");
var babel = require("babel/register");
var browserify = require("browserify");
var babelify = require("babelify");
var source = require('vinyl-source-stream');
var watchify = require("watchify");

var config = {
  entryFile: './src/client.js',
  outputDir: './build/',
  outputFile: 'bundle.js',
  testFiles: 'test/**/*.js',
  srcFiles: 'src/**/*.js'
};

var bundler;
function getBundler() {
  if (!bundler) {
    var options = Object.create(watchify.args);
    options.debug = true;
    bundler = watchify(browserify(config.entryFile, options));
  }
  return bundler;
};

function bundle() {
  return getBundler()
    .transform(babelify)
    .bundle()
    .on('error', function(err) { console.log('Error: ' + err.message); })
    .pipe(source(config.outputFile))
    .pipe(gulp.dest(config.outputDir))
}

gulp.task('build', function(){
  return bundle();
});

gulp.task('compile', ['build'] ,function(){
  process.exit(0);
});

gulp.task('watch-test', function() {
  return gulp.watch([config.srcFiles, config.testFiles],['test']);
});

gulp.task('test', function() {
  return gulp.src([config.testFiles])
    .pipe(mocha({
      compilers: {
        js: babel
      }
    }))
    .once('end', function() {
      process.exit(0);
    });
});

gulp.task('watch', ['build'], function(){
  getBundler().on('update', function() {
    gulp.start('build');
  });
});
