var gulp = require('gulp'),
	clean = require('gulp-clean'),
	jadeToHtml = require('gulp-jade'),
	lessToCss = require('gulp-less'),
	pkg = require('./package.json');

var paths = {
	jade: ['./src/**/*.jade'],
	less: ['./src/**/*.less'],
	js: ['./src/**/*.js',
		'bower_components/angular/angular.min.js{,.map}',
		'bower_components/angular-mocks/angular-mocks.js',
		'bower_components/rxjs/rx.js',
		'bower_components/rxjs/rx.binding.js',
	],
}

const DIST_DIR = './dist';

gulp.task('default', ['build', 'watch']);
gulp.task('clean', function() {
	gulp.src(DIST_DIR, {read: false})
		.pipe(clean());
})

gulp.task('build', ['build:html', 'build:css', 'build:js']);
gulp.task('build:html', function() {
	gulp.src(paths.jade)
		.pipe(jadeToHtml())
		.pipe(gulp.dest(DIST_DIR));
});
gulp.task('build:css', function() {
	gulp.src(paths.less)
		.pipe(lessToCss())
		.pipe(gulp.dest(DIST_DIR));
});
gulp.task('build:js', function() {
	gulp.src(paths.js)
		.pipe(gulp.dest(DIST_DIR));
});

gulp.task('watch', function() {
	gulp.watch(paths.jade, ['build:html']);
	gulp.watch(paths.less, ['build:css']);
	gulp.watch(paths.js, ['build:js']);
});
