let currentImageId = null;

document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    // 获取DOM元素
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const gallery = document.getElementById('gallery');
    const uploadArea = document.getElementById('uploadArea');
    const uploadModal = document.getElementById('uploadModal');
    const imageModal = document.getElementById('imageModal');
    const confirmDialog = document.getElementById('confirmDialog');
    const filePreview = document.getElementById('filePreview');
    const imageNameInput = document.getElementById('imageName');
    const imageTagsInput = document.getElementById('imageTags');
    const confirmUploadBtn = document.getElementById('confirmUpload');
    const cancelUploadBtn = document.getElementById('cancelUpload');

    // 创建Toast提示组件
    const createToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 添加动画类
        setTimeout(() => toast.classList.add('show'), 10);

        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    };

    // 状态变量
    let currentPage = 1;
    const itemsPerPage = 12;
    let currentImages = [];
    let selectedFile = null;

    // 工具函数：防抖
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // API函数
    async function fetchImages() {
        try {
            const searchQuery = searchInput.value;
            const sortBy = sortSelect.value;
            const category = document.querySelector('.category-tag.active')?.dataset.category || 'all';
            
            const response = await fetch(`/api/images?search=${encodeURIComponent(searchQuery)}&sort=${sortBy}&category=${category}`);
            if (!response.ok) throw new Error('获取图片列表失败');
            
            const images = await response.json();
            currentImages = images;
            renderGallery();
        } catch (error) {
            createToast(error.message, 'error');
        }
    }

    async function uploadImage(file) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                createToast('请先登录后再上传图片', 'warning');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1500);
                return;
            }

            const formData = new FormData();
            formData.append('image', file);
            formData.append('customName', imageNameInput.value || file.name);
            formData.append('tags', imageTagsInput.value);

            const progressBar = document.querySelector('.progress');
            progressBar.parentElement.style.display = 'block';
            progressBar.style.width = '0%';

            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '上传失');
            }

            progressBar.style.width = '100%';
            const result = await response.json();
            
            closeUploadModal();
            await fetchImages();
            createToast('上传成功！', 'success');

            setTimeout(() => {
                progressBar.style.width = '0%';
                progressBar.parentElement.style.display = 'none';
            }, 1000);

        } catch (error) {
            createToast(error.message, 'error');
            document.querySelector('.progress').style.width = '0%';
            document.querySelector('.progress-bar').style.display = 'none';
        }
    }

    async function likeImage(imageId) {
        if (!imageId) {
            console.error('无效的图片ID');
            return;
        }
    
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                createToast('请先登录', 'warning');
                window.location.href = '/login.html';
                return;
            }
    
            const response = await fetch(`/api/images/${imageId}/like`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                if (response.status === 401) {
                    createToast('登录已过期，请重新登录', 'warning');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error('点赞失败');
            }
    
            const data = await response.json();
            
            // 更新内存中的图片数据
            const imageIndex = currentImages.findIndex(img => img.id === imageId);
            if (imageIndex !== -1) {
                currentImages[imageIndex].likes = data.likes;
            }
            
            updateAllLikeCounts(imageId, data.likes, data.isLiked);
            
        } catch (error) {
            console.error('点赞失败:', error);
            createToast('操作失败，请重试', 'error');
        }
    }

    async function deleteImage(imageId) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                createToast('请先登录后再删除图片', 'warning');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1500);
                return;
            }

            const response = await fetch(`/api/images/${imageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('删除失败');
            
            closeImageModal();
            await fetchImages();
            createToast('删除成功', 'success');
        } catch (error) {
            createToast(error.message, 'error');
        }
    }

    // 渲染函数
    function renderGallery() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageImages = currentImages.slice(startIndex, endIndex);

        if (currentImages.length === 0) {
            gallery.innerHTML = `
                <div class="gallery-empty">
                    <img src="/images/Goe ovo.png" alt="Not Found" class="empty-image">
                    <div class="empty-text">鸠...好像没有找到呢</div>
                </div>
            `;
            return;
        }        

        gallery.innerHTML = pageImages.map((image, index) => `
            <div class="gallery-item" style="animation-delay: ${index * 0.1}s">
                <div class="image-container">
                    <img src="${image.path}" alt="${image.originalname}" data-image-id="${image.id}">
                </div>
                <div class="gallery-item-info">
                    <div class="gallery-item-header">
                        <h3 class="gallery-item-title">${image.originalname}</h3>
                    </div>
                    <div class="gallery-item-tags">
                        ${(image.tags || []).map(tag => `
                            <span class="tag">${tag}</span>
                        `).join('')}
                    </div>
                    <button class="like-btn" data-image-id="${image.id}">
                        <span class="like-icon">♥</span>
                        <span class="like-count">${image.likes || 0}</span>
                    </button>
                </div>
            </div>
        `).join('');

        // 添加事件监听器
        document.querySelectorAll('.gallery-item .image-container img').forEach(img => {
            img.addEventListener('click', () => {
                const image = currentImages.find(i => i.id === img.dataset.imageId);
                if (image) {
                    showImage(image.path, image.originalname, image.id, image.likes || 0, image.tags || []);
                }
            });
        });

        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const imageId = btn.dataset.imageId;
                if (imageId) {
                    await likeImage(imageId);
                }
            });
        });

        updatePagination();
    }

    function updatePagination() {
        const totalPages = Math.ceil(currentImages.length / itemsPerPage);
        const prevBtn = document.querySelector('.prev-btn');
        const nextBtn = document.querySelector('.next-btn');
        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = currentPage === totalPages;
    }

    function updateAllLikeCounts(imageId, likes, isLiked) {
        if (!imageId) return;
    
        // 更新网格中的点赞数
        const galleryLikeBtn = document.querySelector(`.like-btn[data-image-id="${imageId}"]`);
        if (galleryLikeBtn) {
            const likeCount = galleryLikeBtn.querySelector('.like-count');
            if (likeCount) {
                likeCount.textContent = likes;
            }
            if (isLiked) {
                galleryLikeBtn.classList.add('liked');
            } else {
                galleryLikeBtn.classList.remove('liked');
            }
        }
    
        // 更新模态框中的点赞数
        const modalLikeBtn = imageModal.querySelector('.like-btn');
        if (modalLikeBtn && modalLikeBtn.dataset.imageId === imageId) {
            const modalLikeCount = modalLikeBtn.querySelector('.like-count');
            if (modalLikeCount) {
                modalLikeCount.textContent = likes;
            }
            if (isLiked) {
                modalLikeBtn.classList.add('liked');
            } else {
                modalLikeBtn.classList.remove('liked');
            }
        }
    }

    // 模态框函数
    window.showImage = function(src, title, imageId, likes, tags) {
        console.log('设置当前图片ID:', imageId);
        currentImageId = imageId;
        
        if (!src || !imageId) {
            console.error('Invalid image data:', { src, title, imageId, likes, tags });
            return;
        }

        const currentImage = currentImages.find(img => img.id === imageId);
        if (currentImage) {
            likes = currentImage.likes || 0;
            
            // 设置上传者信息
            const uploaderAvatar = imageModal.querySelector('#uploaderAvatar');
            const uploaderName = imageModal.querySelector('#uploaderName');
            const uploadTime = imageModal.querySelector('#uploadTime');
            
            if (currentImage.uploader) {
                uploaderAvatar.src = currentImage.uploader.avatar || '/images/default-avatar.png';
                uploaderName.textContent = currentImage.uploader.username;
                uploadTime.textContent = new Date(currentImage.uploadDate).toLocaleString();
            }
        }

        const modalImg = imageModal.querySelector('img');
        const modalTitle = imageModal.querySelector('.image-title');
        const modalTags = imageModal.querySelector('.image-tags');
        const likeBtn = imageModal.querySelector('.like-btn');
        
        modalImg.src = src;
        modalTitle.textContent = title || 'Untitled';
        likeBtn.dataset.imageId = imageId;
        likeBtn.querySelector('.like-count').textContent = likes;

        // 清除之前的事件监听器
        const oldLikeBtn = imageModal.querySelector('.like-btn');
        const newLikeBtn = oldLikeBtn.cloneNode(true);
        oldLikeBtn.parentNode.replaceChild(newLikeBtn, oldLikeBtn);
        
        // 添加新的事件监听器
        newLikeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const id = newLikeBtn.dataset.imageId;
            if (id) {
                await likeImage(id);
            }
        });
        
        // 获取点赞状态
        const token = localStorage.getItem('token');
        if (token) {
            fetch(`/api/images/${imageId}/like`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to get like status');
                return response.json();
            })
            .then(data => {
                if (data.isLiked) {
                    newLikeBtn.classList.add('liked');
                } else {
                    newLikeBtn.classList.remove('liked');
                }
            })
            .catch(error => {
                console.error('获取点赞状态失败:', error);
            });
        }

        modalTags.innerHTML = Array.isArray(tags) ? tags.map(tag => `
            <span class="tag">${tag}</span>
        `).join('') : '';
        
        imageModal.classList.add('active');
        setTimeout(() => {
            imageModal.querySelector('.modal-content').style.transform = 'scale(1)';
            imageModal.querySelector('.modal-content').style.opacity = '1';
        }, 10);

        // 删除按钮权限控制
        const deleteBtn = imageModal.querySelector('.delete-btn');
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser && currentImage.uploader && currentUser.id === currentImage.uploader.id) {
            deleteBtn.style.display = 'block';
        } else {
            deleteBtn.style.display = 'none';
        }

        // 加载评论
        loadComments(imageId);
    }

    function closeImageModal() {
        const modalContent = imageModal.querySelector('.modal-content');
        modalContent.style.transform = 'scale(0.8)';
        modalContent.style.opacity = '0';
        setTimeout(() => {
            imageModal.classList.remove('active');
            currentImageId = null;
        }, 300);
    }

    function showUploadModal(file) {
        selectedFile = file;
        imageNameInput.value = file.name;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            filePreview.innerHTML = `<img src="${e.target.result}" alt="预览">`;
        };
        reader.readAsDataURL(file);
        
        uploadModal.classList.add('active');
        setTimeout(() => {
            uploadModal.querySelector('.upload-modal-content').style.transform = 'scale(1)';
            uploadModal.querySelector('.upload-modal-content').style.opacity = '1';
        }, 10);
    }

    function closeUploadModal() {
        const modalContent = uploadModal.querySelector('.upload-modal-content');
        modalContent.style.transform = 'scale(0.8)';
        modalContent.style.opacity = '0';
        setTimeout(() => {
            uploadModal.classList.remove('active');
            selectedFile = null;
            filePreview.innerHTML = '';
            imageNameInput.value = '';
            imageTagsInput.value = '';
        }, 300);
    }

    async function downloadImage(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            link.href = objectUrl;
            link.download = imageModal.querySelector('.image-title').textContent;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
            
            createToast('下载始', 'success');
        } catch (error) {
            createToast('下载失败', 'error');
        }
    }

    // 事件监听
    searchInput?.addEventListener('input', debounce(() => {
        currentPage = 1;
        fetchImages();
    }, 300));

    sortSelect?.addEventListener('change', fetchImages);

    document.querySelectorAll('.category-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            document.querySelector('.category-tag.active')?.classList.remove('active');
            tag.classList.add('active');
            currentPage = 1;
            fetchImages();
        });
    });

    document.querySelector('.prev-btn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderGallery();
        }
    });

    document.querySelector('.next-btn')?.addEventListener('click', () => {
        if (currentPage < Math.ceil(currentImages.length / itemsPerPage)) {
            currentPage++;
            renderGallery();
        }
    });

    // 上传相关事件
    uploadArea?.addEventListener('click', () => {
        const token = localStorage.getItem('token');
        if (!token) {
            createToast('请先登录后再上传图片', 'warning');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1500);
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                showUploadModal(file);
            }
        };
        input.click();
    });

    uploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea?.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const token = localStorage.getItem('token');
        if (!token) {
            createToast('请先登录后再上传图片', 'warning');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1500);
            return;
        }

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            showUploadModal(file);
        } else {
            createToast('请上传图片文件', 'error');
        }
    });

    // 模态框中的按钮事件
    imageModal.querySelector('.like-btn')?.addEventListener('click', () => {
        const imageId = imageModal.querySelector('.like-btn').dataset.imageId;
        if (imageId) {
            likeImage(imageId);
        }
    });

    imageModal.querySelector('.download-btn')?.addEventListener('click', () => {
        const imgSrc = imageModal.querySelector('img').src;
        if (imgSrc) {
            downloadImage(imgSrc);
        }
    });

    imageModal.querySelector('.delete-btn')?.addEventListener('click', () => {
        if (currentImageId) {
            confirmDialog.classList.add('active');
        }
    });

    confirmDialog.querySelector('.cancel-btn')?.addEventListener('click', () => {
        confirmDialog.classList.remove('active');
    });

    confirmDialog.querySelector('.confirm-btn')?.addEventListener('click', () => {
        if (currentImageId) {
            deleteImage(currentImageId);
            confirmDialog.classList.remove('active');
        }
    });

    // 关闭按钮事件
    imageModal.querySelector('.close')?.addEventListener('click', closeImageModal);
    confirmUploadBtn?.addEventListener('click', () => {
        if (selectedFile) {
            uploadImage(selectedFile);
        } else {
            createToast('请选择要上传的图片', 'error');
        }
    });
    cancelUploadBtn?.addEventListener('click', closeUploadModal);

    // 点击模态框背景关闭
    imageModal?.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            closeImageModal();
        }
    });

    confirmDialog?.addEventListener('click', (e) => {
        if (e.target === confirmDialog) {
            confirmDialog.classList.remove('active');
        }
    });

    uploadModal?.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            closeUploadModal();
        }
    });

    // 初始加载
    fetchImages();
});

function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    const userInfo = document.getElementById('userInfo');
    const loginButton = document.getElementById('loginButton');
    const userAvatar = document.getElementById('userAvatar');
    
    if (token && user) {
        userInfo.style.display = 'block';
        loginButton.style.display = 'none';
        if (user.avatar) {
            userAvatar.src = user.avatar;
        }
    } else {
        userInfo.style.display = 'none';
        loginButton.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    checkLoginStatus();
    window.location.reload();
}

// 修改评论提交函数
async function submitComment() {
    const token = localStorage.getItem('token');
    if (!token) {
        createToast('请先登录后再评论', 'warning');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
        return;
    }

    if (!currentImageId) {
        createToast('无法获取图片信息', 'error');
        return;
    }

    const textarea = document.querySelector('.comment-input textarea');
    const commentText = textarea.value.trim();
    if (!commentText) {
        createToast('请输入评论内容', 'warning');
        return;
    }

    const submitButton = document.querySelector('.comment-input button');
    submitButton.disabled = true;

    try {
        const response = await fetch(`/api/images/${currentImageId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: commentText })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '评论发送失败');
        }

        const comment = await response.json();
        console.log('收到新评论数据:', comment);
        
        // 清空输入框
        textarea.value = '';

        // 重新加载评论列表
        await loadComments(currentImageId);
        
        createToast('评论发送成功', 'success');
    } catch (error) {
        console.error('评论发送失败:', error);
        createToast(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

// 修改加载评论函数
async function loadComments(imageId) {
    try {
        const response = await fetch(`/api/images/${imageId}/comments`);
        if (!response.ok) {
            throw new Error('加载评论失败: ' + response.statusText);
        }

        const comments = await response.json();
        const commentsContainer = document.getElementById('comments');
        
        if (!Array.isArray(comments) || comments.length === 0) {
            commentsContainer.innerHTML = `
                <div class="no-comments">
                    <img src="/images/Goe ovo.png" alt="No Comments" class="empty-image">
                    <div class="empty-text">暂无评论，来说两句吧~</div>
                </div>
            `;
            return;
        }

        commentsContainer.innerHTML = comments.map(comment => renderComment(comment)).join('');

    } catch (error) {
        console.error('加载评论失败:', error);
        document.getElementById('comments').innerHTML = 
            '<div class="no-comments">加载评论失败，请刷新重试</div>';
    }
}

// 添加获取当前用户ID的辅助函数
function getCurrentUserId() {
    const user = JSON.parse(localStorage.getItem('user'));
    return user ? user.id : null;
}

// 确保将函数添加到全局作用域
window.submitComment = submitComment;

// 修改 renderComment 函数
function renderComment(comment, isReply = false) {
    const replyClass = isReply ? 'comment-reply' : '';
    const currentUserId = getCurrentUserId();
    const isAuthor = currentUserId === comment.user.id;

    return `
        <div class="comment-item ${replyClass}" data-comment-id="${comment.id}">
            <div class="comment-header">
                <img src="${comment.user.avatar}" alt="${comment.user.username}" class="comment-avatar">
                <div class="comment-info">
                    <div class="comment-username">${comment.user.username}</div>
                    <div class="comment-time">${new Date(comment.createdAt).toLocaleString()}</div>
                </div>
            </div>
            <div class="comment-content">
                ${comment.replyTo ? `<span class="reply-to">回复 ${comment.replyTo}：</span>` : ''}
                ${comment.content}
            </div>
            <div class="comment-actions">
                <button class="like-btn ${comment.isLiked ? 'liked' : ''}" onclick="likeComment('${comment.id}')">
                    <span class="like-icon">♥</span>
                    <span class="like-count">${comment.likes || 0}</span>
                </button>
                <button class="reply-btn" onclick="showReplyForm('${comment.id}', '${comment.user.username}')">
                    回复
                </button>
                ${isAuthor ? `
                    <button class="delete-btn" onclick="deleteComment('${comment.id}')">
                        删除
                    </button>
                ` : ''}
            </div>
            ${!isReply ? `
                <div class="reply-form" style="display: none;">
                    <textarea placeholder="回复 ${comment.user.username}..." rows="2"></textarea>
                    <div class="reply-form-actions">
                        <button class="cancel-reply-btn" onclick="hideReplyForm('${comment.id}')">取消</button>
                        <button class="submit-reply-btn" onclick="submitReply('${comment.id}', '${comment.user.username}')">
                            发送回复
                        </button>
                    </div>
                </div>
                <div class="replies-container" id="replies-${comment.id}">
                    ${comment.reply_count > 0 ? 
                        `<div class="show-replies" onclick="loadReplies('${comment.id}')">
                            查看 ${comment.reply_count} 条回复
                        </div>` : 
                        ''}
                </div>
            ` : ''}
        </div>
    `;
}

// 修改删除评论函数
async function deleteComment(commentId) {
    // 显示确认对话框
    const dialog = document.getElementById('confirmDeleteCommentDialog');
    dialog.classList.add('active');

    // 获取按钮
    const confirmBtn = dialog.querySelector('.confirm-btn');
    const cancelBtn = dialog.querySelector('.cancel-btn');

    // 创建Promise以等待用户响应
    const userResponse = new Promise((resolve) => {
        const handleConfirm = () => {
            dialog.classList.remove('active');
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            dialog.classList.remove('active');
            cleanup();
            resolve(false);
        };

        const handleOutsideClick = (e) => {
            if (e.target === dialog) {
                dialog.classList.remove('active');
                cleanup();
                resolve(false);
            }
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            dialog.removeEventListener('click', handleOutsideClick);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        dialog.addEventListener('click', handleOutsideClick);
    });

    // 等待用户确认
    const shouldDelete = await userResponse;
    if (!shouldDelete) return;

    try {
        const response = await fetch(`/api/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('删除评论失败');
        }

        const result = await response.json();
        
        if (result.parentId) {
            // 如果是回复，重新加载父评论的回复列表
            await loadReplies(result.parentId);
        } else {
            // 如果是主评论，重新加载整个评论列表
            await loadComments(currentImageId);
        }
        
        createToast('评论已删除', 'success');
    } catch (error) {
        console.error('删除评论失败:', error);
        createToast(error.message, 'error');
    }
}

// 确保将删除函数添加到全局作用域
window.deleteComment = deleteComment;

// 显示回复表单
function showReplyForm(commentId, username) {
    const token = localStorage.getItem('token');
    if (!token) {
        createToast('请先登录后再回复', 'warning');
        setTimeout(() => window.location.href = '/login.html', 1500);
        return;
    }
    
    document.querySelectorAll('.reply-form').forEach(form => form.style.display = 'none');
    const replyForm = document.querySelector(`.comment-item[data-comment-id="${commentId}"] .reply-form`);
    if (replyForm) {
        replyForm.style.display = 'block';
        replyForm.querySelector('textarea').focus();
    }
}

// 隐藏回复表单
function hideReplyForm(commentId) {
    const replyForm = document.querySelector(`.comment-item[data-comment-id="${commentId}"] .reply-form`);
    if (replyForm) {
        replyForm.style.display = 'none';
        replyForm.querySelector('textarea').value = '';
    }
}

// 修改提交回复函数
async function submitReply(parentId, replyToUsername) {
    const replyForm = document.querySelector(`.comment-item[data-comment-id="${parentId}"] .reply-form`);
    const textarea = replyForm.querySelector('textarea');
    const content = textarea.value.trim();
    
    if (!content) {
        createToast('请输入回复内容', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/images/${currentImageId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                content,
                parentId,
                replyTo: replyToUsername
            })
        });

        if (!response.ok) throw new Error('回复发送失败');
        
        const reply = await response.json();
        
        // 添加回复到列表
        const repliesContainer = document.getElementById(`replies-${parentId}`);
        
        // 如果还没有加载回复，先清空容器
        if (repliesContainer.querySelector('.show-replies')) {
            repliesContainer.innerHTML = '';
        }
        
        // 添加新回复
        const replyElement = document.createElement('div');
        replyElement.innerHTML = renderComment(reply, true);
        repliesContainer.appendChild(replyElement);
        
        hideReplyForm(parentId);
        createToast('回复发送成功', 'success');
    } catch (error) {
        createToast(error.message, 'error');
    }
}

// 修改加载回复函数
async function loadReplies(commentId) {
    try {
        const response = await fetch(`/api/comments/${commentId}/replies`);
        if (!response.ok) throw new Error('加载回复失败');
        
        const replies = await response.json();
        const repliesContainer = document.getElementById(`replies-${commentId}`);
        
        if (!replies || replies.length === 0) {
            // 如果没有回复了，清空回复容器
            repliesContainer.innerHTML = '';
            return;
        }
        
        // 染回复
        repliesContainer.innerHTML = replies.map(reply => renderComment(reply, true)).join('');
    } catch (error) {
        createToast(error.message, 'error');
    }
}

// 添加评论点赞函数
async function likeComment(commentId) {
    const token = localStorage.getItem('token');
    if (!token) {
        createToast('请先登录后再点赞', 'warning');
        setTimeout(() => window.location.href = '/login.html', 1500);
        return;
    }

    try {
        const response = await fetch(`/api/comments/${commentId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('点赞失败');
        
        const data = await response.json();
        
        // 更新点赞按钮状态
        const likeButtons = document.querySelectorAll(`.like-btn[onclick="likeComment('${commentId}')"]`);
        likeButtons.forEach(btn => {
            const likeCount = btn.querySelector('.like-count');
            likeCount.textContent = data.likes;
            btn.classList.toggle('liked', data.isLiked);
        });

    } catch (error) {
        console.error('点赞失败:', error);
        createToast(error.message, 'error');
    }
}

// 确保将点赞函数添加到全局作用域
window.likeComment = likeComment;
