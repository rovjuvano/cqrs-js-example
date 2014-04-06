var gulp = require('gulp'),
	clean = require('gulp-clean'),
	jadeToHtml = require('gulp-jade'),
	lessToCss = require('gulp-less'),
	pkg = require('./package.json');

var paths = {
	jade: ['./src/**/*.jade'],
	less: ['./src/**/*.less'],
	raw: ['./src/**/*.js',
		'bower_components/angular/angular.min.js{,.map}',
		'bower_components/angular-mocks/angular-mocks.js',
		'bower_components/rxjs/rx.js',
		'bower_components/rxjs/rx.binding.js',
		'bower_components/rxjs/rx.aggregates.js',
	],
}

const DIST_DIR = './dist';

gulp.task('default', ['build', 'watch']);
gulp.task('clean', function() {
	gulp.src(DIST_DIR, {read: false})
		.pipe(clean());
})

gulp.task('build', ['build:jade', 'build:less', 'build:raw']);
gulp.task('build:jade', function() {
	gulp.src(paths.jade)
		.pipe(jadeToHtml())
		.pipe(gulp.dest(DIST_DIR));
});
gulp.task('build:less', function() {
	gulp.src(paths.less)
		.pipe(lessToCss())
		.pipe(gulp.dest(DIST_DIR));
});
gulp.task('build:raw', function() {
	gulp.src(paths.raw)
		.pipe(gulp.dest(DIST_DIR));
});

gulp.task('watch', function() {
	gulp.watch(paths.jade, ['build:jade']);
	gulp.watch(paths.less, ['build:less']);
	gulp.watch(paths.raw, ['build:raw']);
});
