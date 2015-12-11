require('babel/register');

var gulp = require('gulp');

var babel = require('gulp-babel');
var mocha = require('gulp-mocha');

var config = {
  entryFile: './src/client.js',
  testFiles: 'test/**/*.js',
  srcFiles: 'src/**/*.js',
  outDir: './lib'
};

gulp.task('build', function() {
  return gulp.src([config.srcFiles])
    .pipe(babel())
    .pipe(gulp.dest(config.outDir));
});

gulp.task('watch', ['build'], function() {
  return gulp.watch([config.srcFiles], ['build']);
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
