const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator');
const Post = require('../models/post');
const User = require('../models/user');

const io = require('../socket');
const user = require('../models/user');

module.exports = {

    getPosts(req, res, next) {
        const currentPage = req.query.page || 1;
        const perPage = 2;
        let totalItems;
        Post.find()
            .countDocuments()
            .then(count => {
                totalItems = count;
                return Post.find()
                    .populate('creator')
                    .skip((currentPage - 1) * perPage)
                    .limit(perPage);
            })
            .then(posts => {
                res
                    .status(200)
                    .send({
                        message: 'Fetched posts successfully.',
                        posts: posts,
                        totalItems: totalItems
                    });
            })
            .catch(err => {
                if (!err.statusCode) {
                    err.statusCode = 500;
                }
                next(err);
            });
    },

    createPost(req, res, next) {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            const error = new Error('Validation failed, entered data is incorrect.');
            error.statusCode = 422;
            throw error;
        }

        if (!req.file) {
            const error = new Error('No image provided.');
            error.statusCode = 422;
            throw error;
        }

        const imageUrl = req.file.path.replace("\\", "/");
        const title = req.body.title;
        const content = req.body.content;

        const post = new Post({
            title: title,
            content: content,
            imageUrl: imageUrl,
            creator: req.userId
        });

        post.save()
            .then(result => {
                return User.findById(req.userId);
            })
            .then(user => {
                creator = user;
                user.posts.push(post);
                return user.save();
            })
            .then(result => {
                io.getIo().emit('Posts', { action: 'create', post: { ...post._doc, creator: { _id: req.userId, name: user.name } } })
                res.status(201).json({
                    message: 'Post created successfully!',
                    post: post,
                    creator: { _id: creator._id, name: creator.name }
                });
            })
            .catch(err => {
                if (!err.statusCode) {
                    err.statusCode = 500;
                }
                next(err);
            });

    },

    getPost(req, res, next) {
        const postId = req.params.postId;
        Post.findById(postId)
            .then(post => {
                if (!post) {
                    const error = new Error('Could not find post.');
                    error.statusCode = 404;
                    throw error;
                }
                res.status(200).send({ message: 'Post fetched.', post: post });
            })
            .catch(err => {
                if (!err.statusCode) {
                    err.statusCode = 500;
                }
                next(err);
            });
    },

    updatePost(req, res, next) {
        const postId = req.params.postId;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const error = new Error('Validation failed, entered data is incorrect.');
            error.statusCode = 422;
            throw error;
        }
        const title = req.body.title;
        const content = req.body.content;
        let imageUrl = req.body.image;
        if (req.file) {
            imageUrl = req.file.path.replace("\\", "/");
        }
        if (!imageUrl) {
            const error = new Error('No file picked.');
            error.statusCode = 422;
            throw error;
        }
        Post.findById(postId)
            .populate('creator')
            .then(post => {
                if (!post) {
                    const error = new Error('Could not find post.');
                    error.statusCode = 404;
                    throw error;
                }
                if (post.creator._id.toString() !== req.userId) {
                    const error = new Error('Not authorized!');
                    error.statusCode = 403;
                    throw error;
                }
                if (imageUrl !== post.imageUrl) {
                    clearImage(post.imageUrl);
                }
                post.title = title;
                post.imageUrl = imageUrl;
                post.content = content;
                return post.save();
            })
            .then(result => {
                io.getIo().emit('Posts', { action: 'update', post: result });
                res.status(200).send({ message: 'Post updated!', post: result });
            })
            .catch(err => {
                if (!err.statusCode) {
                    err.statusCode = 500;
                }
                next(err);
            })
    },

    deletePost(req, res, next) {
        const postId = req.params.postId;
        Post.findById(postId)
            .then(post => {
                if (!post) {
                    const error = new Error('Could not find post.');
                    error.statusCode = 404;
                    throw error;
                }
                if (post.creator.toString() !== req.userId) {
                    const error = new Error('Not authorized!');
                    error.statusCode = 403;
                    throw error;
                }
                // Check logged in user
                clearImage(post.imageUrl);
                return Post.findByIdAndRemove(postId);
            })
            .then(result => {
                return User.findById(req.userId);
            })
            .then(user => {
                user.posts.pull(postId);
                return user.save();
            })
            .then(result => {
                io.getIo().emit('Posts', { action: 'delete', post: postId });
                res.status(200).send({ message: 'Deleted post.' });
            })
            .catch(err => {
                if (!err.statusCode) {
                    err.statusCode = 500;
                }
                next(err);
            })
    }
}

const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => console.log(err));
};

