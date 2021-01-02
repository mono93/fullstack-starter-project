const express = require('express');
const { check } = require('express-validator');

const User = require('../models/user');
const authController = require('../controller/auth');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.put(
    '/signup',
    [
        check('email')
            .isEmail()
            .withMessage('Please enter a valid email.')
            .custom((value, { req }) => {
                return User.findOne({ email: value }).then(userDoc => {
                    if (userDoc) {
                        return Promise.reject('E-Mail address already exists!');
                    }
                });
            })
            .normalizeEmail(),
        check('password')
            .trim()
            .isLength({ min: 5 }),
        check('name')
            .trim()
            .not()
            .isEmpty()
    ],
    authController.signup
);

router.post('/login', authController.login);
router.get('/status', isAuth, authController.getStatus);
router.patch('/status', isAuth, [check('status').trim().not().isEmpty()], authController.updateStatus);

module.exports = router;
